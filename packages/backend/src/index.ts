import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';

import { connectDatabase } from './config/database.js';
import { startCacheUpdateJob } from './jobs/updateCache.js';

import playlistRoutes from './routes/playlists.js';
import songRoutes from './routes/songs.js';
import artistRoutes from './routes/artists.js';
import channelRoutes from './routes/channels.js';
import recommendationRoutes from './routes/recommendations.js';
import authRoutes from './routes/auth.js';
import youtubeRoutes from './routes/youtube.js';
import ytmusicRoutes from './routes/ytmusic.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_PATH = path.resolve(__dirname, '../.env');
const envResult = dotenv.config({ path: ENV_PATH, override: true });
if (envResult.error) {
  console.error('dotenv load error:', envResult.error);
} else {
console.log('.env path:', ENV_PATH);
}
console.log('Environment variables loaded:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set (' + process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...)' : 'Missing');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing');
console.log('.env path:', ENV_PATH);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Missing');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:5179',
  'http://localhost:5180',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPSの場合はtrue
    httpOnly: true, // XSS対策
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30日
  }
}));

// ユーザー認証
// セッションベースの認証
app.use('/api/auth', authRoutes);

// プレイリスト関連
app.use('/api/songs', songRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/recommendations', recommendationRoutes);

// YouTube API
app.use('/api/youtube', youtubeRoutes);

// YouTube Music API
app.use('/api/ytmusic', ytmusicRoutes);

// プレイリスト関連
app.use('/api/playlists', playlistRoutes);

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'YouTube Orchestrator API is running' });
});

// サーバー起動
app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Session-based authentication enabled`);

    await connectDatabase();

  // Preload valid user tokens
  try {
    const { User } = await import('./models/User.js');
    const { registerUserToken } = await import('./jobs/updateCache.js');
    const now = new Date();
    const users = await User.find({ youtubeAccessToken: { $exists: true, $ne: null } });
    for (const u of users) {
      if (!u.youtubeTokenExpiry || u.youtubeTokenExpiry > now) {
        registerUserToken(
          u.googleId,
          u.youtubeAccessToken as string,
          u.youtubeRefreshToken as string | undefined,
          u.youtubeTokenExpiry
        );
      }
    }
    console.log(`Preloaded tokens for ${users.length} users`);
  } catch (e) {
    console.warn('Skipping token preload:', e?.toString?.() || e);
  }

  startCacheUpdateJob();
});


/**
 * YouTube Orchestrator - バックエンドエントリポイント
 *
 * 概要:
 * - 環境変数（.env）の読み込み
 * - Express アプリの初期化（CORS/JSON/Cookie/セッション）
 * - 各 API ルートの登録（認証・プレイリスト・アーティスト・チャンネル・検索など）
 * - ヘルスチェックエンドポイント
 * - データベース接続とトークンのプリロード
 * - バックグラウンドジョブの起動
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';

// DB 接続およびキャッシュ更新ジョブ
import { connectDatabase } from './config/database.js';
import { startCacheUpdateJob } from './jobs/updateCache.js';

// ルートのインポート
import playlistRoutes from './routes/playlists.js';
import songRoutes from './routes/songs.js';
import artistRoutes from './routes/artists.js';
import channelRoutes from './routes/channels.js';
import recommendationRoutes from './routes/recommendations.js';
import authRoutes from './routes/auth.js';
import youtubeRoutes from './routes/youtube.js';
import ytmusicRoutes from './routes/ytmusic.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ESModule で __dirname を得るためのおまじない
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env の読み込み（ルート直下の .env を優先）
const ENV_PATH = path.resolve(__dirname, '../.env');
const envResult = dotenv.config({ path: ENV_PATH, override: true });
if (envResult.error) {
  console.error('dotenv load error:', envResult.error);
} else {
  console.log('.env path:', ENV_PATH);
}

// 簡易な環境変数の可視化（値そのものは出力しない）
console.log('Environment variables loaded:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set (' + process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...)' : 'Missing');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing');
console.log('.env path:', ENV_PATH);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Missing');

const app = express();
const PORT = process.env.PORT || 3001;

// フロントエンドの開発ポートと FRONTEND_URL を許可
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:5179',
  'http://localhost:5180',
  process.env.FRONTEND_URL
].filter(Boolean);

// CORS 設定（認証付き通信を許可）
app.use(cors({
  origin: (origin, callback) => {
    // origin が空（同一オリジンやモバイルアプリなど）の場合は許可
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// JSON / Cookie 取り扱い
app.use(express.json());
app.use(cookieParser());

// セッション設定（サーバー側ストアは既定、必要に応じて外部ストアに移行）
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // 本番では HTTPS のみ
    httpOnly: true, // XSS 対策（JS から参照不可）
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 日
  }
}));

// 認証関連（セッションベースの認証）
app.use('/api/auth', authRoutes);

// コンテンツ（プレイリスト・アーティスト・チャンネル・おすすめ）
app.use('/api/songs', songRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/recommendations', recommendationRoutes);

// YouTube API（動画向け）
app.use('/api/youtube', youtubeRoutes);

// YouTube Music API（音楽向け）
app.use('/api/ytmusic', ytmusicRoutes);

// プレイリスト
app.use('/api/playlists', playlistRoutes);

// ヘルスチェック
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'YouTube Orchestrator API is running' });
});

// サーバー起動
app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Session-based authentication enabled`);

  // MongoDB へ接続
  await connectDatabase();

  // User コレクションから有効な YouTube アクセストークンをプリロード
  try {
    const { User } = await import('./models/User.js');
    const { registerUserToken } = await import('./jobs/updateCache.js');
    const now = new Date();
    const users = await User.find({ youtubeAccessToken: { $exists: true, $ne: null } });
    for (const u of users) {
      if (!u.youtubeTokenExpiry || u.youtubeTokenExpiry > now) {
        registerUserToken(
          u.googleId,
          u.youtubeAccessToken as string,
          u.youtubeRefreshToken as string | undefined,
          u.youtubeTokenExpiry
        );
      }
    }
    console.log(`Preloaded tokens for ${users.length} users`);
  } catch (e) {
    console.warn('Skipping token preload:', e?.toString?.() || e);
  }

  // バックグラウンドのキャッシュ更新ジョブを開始
  startCacheUpdateJob();
});
