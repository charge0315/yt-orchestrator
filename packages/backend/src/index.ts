/**
 * YouTube Orchestrator - バックエンドエントリポイント
 *
 * 概要:
 * - 環境変数（.env）の読み込み
 * - Express アプリの初期化（CORS/JSON/Cookie/セッション）
 * - 各 API ルートの登録（認証・検索など）
 * - ヘルスチェックエンドポイント
 * - データベース接続とトークンのプリロード
 * - バックグラウンドジョブの起動
 */
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'
import session from 'express-session'

// DB 接続およびキャッシュ更新ジョブ
import { connectDatabase } from './config/database.js'
import { startCacheUpdateJob } from './jobs/updateCache.js'

// ルートのインポート
import songRoutes from './routes/songs.js'
import recommendationRoutes from './routes/recommendations.js'
import authRoutes from './routes/auth.js'
import cacheRoutes from './routes/cache.js'
import youtubeRoutes from './routes/youtube.js'
import ytmusicRoutes from './routes/ytmusic.js'
import allPlaylistsRoutes from './routes/allPlaylists.js'
import cachedChannelsRoutes from './routes/cachedChannels.js' // 旧: channelsRoutes（名称変更）
import cachedArtistsRoutes from './routes/cachedArtists.js' // 旧: artistsRoutes（名称変更）
import { seedInitialData } from './utils/seedData.js'
import path from 'path'
import { fileURLToPath } from 'url'

// ESModule で __dirname を得るためのおまじない
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// .env の読み込み（ルート直下の .env を優先）
const ENV_PATH = path.resolve(__dirname, '../.env')
const envResult = dotenv.config({ path: ENV_PATH, override: true })
if (envResult.error) {
  console.error('dotenv 読み込みエラー:', envResult.error)
} else {
  console.log('.env path:', ENV_PATH)
}

// 簡易な環境変数の可視化（値そのものは出力しない）
console.log('環境変数の読み込み状況:')
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '設定済み (' + process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...)' : '未設定')
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '設定済み' : '未設定')
console.log('.env path:', ENV_PATH)
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '設定済み' : '未設定')

const app = express()
const PORT = process.env.PORT || 3000

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
  process.env.FRONTEND_URL,
].filter(Boolean) as string[]

const isLocalhost = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)

// CORS 設定（認証付き通信を許可）
app.use(
  cors({
    origin: (origin, callback) => {
      // origin が空（同一オリジンやモバイルアプリなど）の場合は許可
      if (!origin) return callback(null, true)
      if (allowedOrigins.indexOf(origin) !== -1 || isLocalhost(origin)) {
        callback(null, true)
      } else {
        callback(new Error('CORS により拒否されました'))
      }
    },
    credentials: true,
  })
)

// JSON / Cookie 取り扱い
app.use(express.json())
app.use(cookieParser())

// セッション設定（サーバー側ストアは既定、必要に応じて外部ストアに移行）
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // 本番では HTTPS のみ
      httpOnly: true, // XSS 対策（JS から参照不可）
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 日
    },
  })
)

// 認証関連（セッションベースの認証）
app.use('/api/auth', authRoutes)

// キャッシュ操作
app.use('/api/cache', cacheRoutes)

// コンテンツ
app.use('/api/songs', songRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/playlists', allPlaylistsRoutes)
app.use('/api/channels', cachedChannelsRoutes)
app.use('/api/artists', cachedArtistsRoutes)

// YouTube API（動画向け）
app.use('/api/youtube', youtubeRoutes)

// YouTube Music API（音楽向け）
app.use('/api/ytmusic', ytmusicRoutes)

// ヘルスチェック
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'YouTube Orchestrator API は稼働中です' })
})

// サーバー起動
app.listen(PORT, async () => {
  console.log(`サーバー起動: http://localhost:${PORT}`)
  console.log('セッションベース認証を有効化しました')

  // MongoDB へ接続
  await connectDatabase()
  try {
    await seedInitialData()
  } catch (seedError) {
    console.warn('初期データ seed をスキップします:', seedError instanceof Error ? seedError.message : seedError)
  }

  // User コレクションから有効な YouTube アクセストークンをプリロード
  try {
    const { User } = await import('./models/User.js')
    const { registerUserToken } = await import('./jobs/updateCache.js')
    const now = new Date()
    const users = await User.find({ youtubeAccessToken: { $exists: true, $ne: null } })
    for (const u of users) {
      if (!u.youtubeTokenExpiry || u.youtubeTokenExpiry > now) {
        registerUserToken(
          u.googleId,
          u.youtubeAccessToken as string,
          u.youtubeRefreshToken as string | undefined,
          u.youtubeTokenExpiry
        )
      }
    }
    console.log(`トークンをプリロードしました: ${users.length} ユーザー`)
  } catch (e) {
    console.warn('トークンのプリロードをスキップします:', e?.toString?.() || e)
  }

  // バックグラウンドのキャッシュ更新ジョブを開始（環境変数で制御）
  // YouTube APIのクォータ節約のため、デフォルトは無効化
  if (process.env.ENABLE_CACHE_UPDATE_JOB === 'true') {
    startCacheUpdateJob()
    console.log('✅ バックグラウンドキャッシュ更新ジョブを有効化しました')
  } else {
    console.log('⚠️  バックグラウンドキャッシュ更新ジョブは無効です（有効化: ENABLE_CACHE_UPDATE_JOB=true）')
  }
})