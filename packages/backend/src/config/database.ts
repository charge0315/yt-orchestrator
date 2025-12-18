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
      console.warn('環境変数により MongoDB 接続が無効化されています（DISABLE_MONGO=1 または MONGODB_URI=disabled）。DB なしで続行します。');
      return;
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yt-orchestrator';
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? '設定済み' : '未設定');
    try {
      const parsed = new URL(mongoUri.replace('mongodb+srv', 'http').replace('mongodb', 'http'));
      console.log('MongoDB 接続先ホスト:', parsed.host);
    } catch {}
    await mongoose.connect(mongoUri);
    console.log('MongoDB 接続に成功しました');
  } catch (error) {
    console.error('MongoDB 接続エラー:', error);
    // 接続エラーでもアプリケーションは続行（フォールバック対応）
  }
}

/**
 * MongoDBから切断
 */
export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    console.log('MongoDB を切断しました');
  } catch (error) {
    console.error('MongoDB 切断エラー:', error);
  }
}
