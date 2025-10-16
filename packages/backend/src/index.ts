import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';

// Routes
import playlistRoutes from './routes/playlists.js';
import songRoutes from './routes/songs.js';
import artistRoutes from './routes/artists.js';
import channelRoutes from './routes/channels.js';
import recommendationRoutes from './routes/recommendations.js';
import authRoutes from './routes/auth.js';
import youtubePlaylistRoutes from './routes/youtubePlaylists.js';
import youtubeChannelRoutes from './routes/youtubeChannels.js';
import youtubeRecommendationRoutes from './routes/youtubeRecommendations.js';
import youtubeRoutes from './routes/youtube.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
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
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Allow cookies
}));
app.use(express.json());
app.use(cookieParser());

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yt-orchestrator');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/youtube/playlists', youtubePlaylistRoutes);
app.use('/api/youtube/channels', youtubeChannelRoutes);
app.use('/api/youtube/recommendations', youtubeRecommendationRoutes);
app.use('/api/youtube', youtubeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'YouTube Orchestrator API is running' });
});

// Start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
};

startServer();
