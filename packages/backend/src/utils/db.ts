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
    console.log('Already connected to MongoDB');
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️  MONGODB_URI is not set. MongoDB caching will be disabled.');
    return;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('✅ Connected to MongoDB');

    // 接続エラーハンドリング
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
      isConnected = false;
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
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
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Failed to disconnect from MongoDB:', error);
    throw error;
  }
}

/**
 * MongoDB接続状態を確認
 */
export function isMongoDBConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
