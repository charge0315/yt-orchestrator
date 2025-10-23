/**
 * MongoDB データベース接続設定
 */
import mongoose from 'mongoose';

/**
 * MongoDBに接続
 */
export async function connectDatabase() {
  try {
    const disabled = process.env.DISABLE_MONGO === '1' ||
      (process.env.MONGODB_URI && process.env.MONGODB_URI.toLowerCase() === 'disabled');
    if (disabled) {
      console.warn('MongoDB connection disabled by environment (DISABLE_MONGO=1 or MONGODB_URI=disabled). Running without DB.');
      return;
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yt-orchestrator';
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Missing');
    try {
      const parsed = new URL(mongoUri.replace('mongodb+srv', 'http').replace('mongodb', 'http'));
      console.log('MongoDB target host:', parsed.host);
    } catch {}
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
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
