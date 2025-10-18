/**
 * MongoDB データベース接続設定
 */
import mongoose from 'mongoose';

/**
 * MongoDBに接続
 */
export async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yt-orchestrator';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    // 接続エラーでもアプリケーションは続行（フォールバック対応）
  }
}

/**
 * MongoDBから切断
 */
export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
  }
}
