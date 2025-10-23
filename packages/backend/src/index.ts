/**
 * YouTube Orchestrator - 繝舌ャ繧ｯ繧ｨ繝ｳ繝峨し繝ｼ繝舌・
 * YouTube Data API v3縺ｨ騾｣謳ｺ縺励√・繝ｬ繧､繝ｪ繧ｹ繝育ｮ｡逅・ｄAI縺翫☆縺吶ａ讖溯・繧呈署萓・
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';

import { connectDatabase } from './config/database.js';
import { startCacheUpdateJob } from './jobs/updateCache.js';

// 繝ｫ繝ｼ繝医・繧､繝ｳ繝昴・繝・
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

// ES繝｢繧ｸ繝･繝ｼ繝ｫ縺ｧ__dirname繧貞叙蠕励☆繧九◆繧√・蜃ｦ逅・
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 迺ｰ蠅・､画焚縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ・・./backend/.env縺九ｉ隱ｭ縺ｿ霎ｼ繧・・const ENV_PATH = path.resolve(__dirname, '../.env');\nconst envResult = dotenv.config({ path: ENV_PATH, override: true });\nif (envResult.error) {\n  console.error('dotenv load error:', envResult.error);\n} else {\n  console.log('dotenv loaded from:', ENV_PATH);\n}

// 繝・ヰ繝・げ: 迺ｰ蠅・､画焚縺梧ｭ｣縺励￥隱ｭ縺ｿ霎ｼ縺ｾ繧後※縺・ｋ縺狗｢ｺ隱・
console.log('Environment variables loaded:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set (' + process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...)' : 'Missing');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing');
console.log('.env path:', ENV_PATH);\nconsole.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Missing');

const app = express();
const PORT = process.env.PORT || 3001;

// 繝溘ラ繝ｫ繧ｦ繧ｧ繧｢縺ｮ險ｭ螳・

// CORS險ｭ螳・ 繝輔Ο繝ｳ繝医お繝ｳ繝峨°繧峨・繝ｪ繧ｯ繧ｨ繧ｹ繝医ｒ險ｱ蜿ｯ
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
    // origin縺後↑縺・ｴ蜷医・險ｱ蜿ｯ・医Δ繝舌う繝ｫ繧｢繝励Μ繧・url縺ｪ縺ｩ・・
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Cookie縺ｮ騾∽ｿ｡繧定ｨｱ蜿ｯ
}));
app.use(express.json()); // JSON繝懊ョ繧｣縺ｮ繝代・繧ｹ
app.use(cookieParser()); // Cookie 縺ｮ繝代・繧ｹ

// 繧ｻ繝・す繝ｧ繝ｳ險ｭ螳・
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // 譛ｬ逡ｪ迺ｰ蠅・〒縺ｯHTTPS縺ｮ縺ｿ
    httpOnly: true, // XSS謾ｻ謦・ｯｾ遲・
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30譌･髢・
  }
}));

// 繝ｫ繝ｼ繝医・逋ｻ骭ｲ
// 隱崎ｨｼ繝ｫ繝ｼ繝・
app.use('/api/auth', authRoutes);

// 蝓ｺ譛ｬ逧・↑繝ｪ繧ｽ繝ｼ繧ｹ繝ｫ繝ｼ繝・
app.use('/api/songs', songRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/recommendations', recommendationRoutes);



// YouTube API騾｣謳ｺ繝ｫ繝ｼ繝・
app.use('/api/youtube', youtubeRoutes);

// YouTube Music API騾｣謳ｺ繝ｫ繝ｼ繝・
app.use('/api/ytmusic', ytmusicRoutes);

// 繝励Ξ繧､繝ｪ繧ｹ繝医Ν繝ｼ繝・
app.use('/api/playlists', playlistRoutes);

// 繝倥Ν繧ｹ繝√ぉ繝・け繧ｨ繝ｳ繝峨・繧､繝ｳ繝・
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'YouTube Orchestrator API is running' });
});

// サーバー起動
app.listen(PORT, async () => {
  console.log(`噫 Server is running on http://localhost:${PORT}`);
  console.log(`笨・Session-based authentication enabled`);

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
    console.log(`笨・Preloaded tokens for ${users.length} users`);
  } catch (e) {
    console.warn('Skipping token preload:', e?.toString?.() || e);
  }

  startCacheUpdateJob();
});

