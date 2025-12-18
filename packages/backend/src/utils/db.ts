/**
 * MongoDB接続ユーティリティ
 */
import mongoose from 'mongoose';

let isConnected = false;

/**
 * MongoDBに接続
 */
export async function connectDB(): Promise<void> {
  if (isConnected) {
    console.log('MongoDB は既に接続済みです');
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️  MONGODB_URI が未設定です。MongoDB キャッシュは無効になります。');
    return;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('✅ MongoDB に接続しました');

    // 接続エラーハンドリング
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB 接続エラー:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB から切断されました');
      isConnected = false;
    });
  } catch (error) {
    console.error('MongoDB への接続に失敗しました:', error);
    throw error;
  }
}

/**
 * MongoDBから切断
 */
export async function disconnectDB(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB から切断しました');
  } catch (error) {
    console.error('MongoDB の切断に失敗しました:', error);
    throw error;
  }
}

/**
 * MongoDB接続状態を確認
 */
export function isMongoDBConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
