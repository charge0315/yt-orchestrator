/**
 * YouTube Orchestrator - バックエンドサーバー
 * YouTube Data API v3と連携し、プレイリスト管理やAIおすすめ機能を提供
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';

// データベースとジョブのインポート
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

// ESモジュールで__dirnameを取得するための処理
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数の読み込み（../backend/.envから読み込む）
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// デバッグ: 環境変数が正しく読み込まれているか確認
console.log('Environment variables loaded:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set (' + process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...)' : 'Missing');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing');
console.log('.env path:', path.resolve(__dirname, '../.env'));

const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェアの設定

// CORS設定: フロントエンドからのリクエストを許可
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
    // originがない場合は許可（モバイルアプリやcurlなど）
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Cookieの送信を許可
}));
app.use(express.json()); // JSONボディのパース
app.use(cookieParser()); // Cookie のパース

// セッション設定
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // 本番環境ではHTTPSのみ
    httpOnly: true, // XSS攻撃対策
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30日間
  }
}));

// ルートの登録
// 認証ルート
app.use('/api/auth', authRoutes);

// 基本的なリソースルート
app.use('/api/songs', songRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/recommendations', recommendationRoutes);



// YouTube API連携ルート
app.use('/api/youtube', youtubeRoutes);

// YouTube Music API連携ルート
app.use('/api/ytmusic', ytmusicRoutes);

// プレイリストルート
app.use('/api/playlists', playlistRoutes);

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'YouTube Orchestrator API is running' });
});

// サーバー起動
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`✅ Session-based authentication enabled`);

  // MongoDB接続
  await connectDatabase();

  // MongoDBから有効なユーザートークンをプリロード
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
    console.log(`✅ Preloaded tokens for ${users.length} users`);
  } catch (e) {
    console.warn('Skipping token preload:', e?.toString?.() || e);
  }

  // バックグラウンドジョブ開始
  startCacheUpdateJob();
});
