/**
 * MongoDBキャッシュデータの確認スクリプト
 */
import mongoose from 'mongoose';
import { CachedChannel } from '../models/CachedChannel.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkCache() {
  try {
    // MongoDB接続
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yt-orchestrator';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');

    // サンプルチャンネルを1件取得
    const channel = await CachedChannel.findOne().lean();

    if (channel) {
      console.log('\n📋 Sample Channel Data:');
      console.log('Channel Title:', channel.channelTitle);
      console.log('Latest Video Title:', channel.latestVideoTitle);
      console.log('Latest Video ID:', channel.latestVideoId);
      console.log('Latest Video Thumbnail:', channel.latestVideoThumbnail);
      console.log('Cached At:', channel.cachedAt);

      // 全チャンネルの統計
      const totalChannels = await CachedChannel.countDocuments();
      const withVideoTitle = await CachedChannel.countDocuments({
        latestVideoTitle: { $exists: true, $ne: null }
      });

      console.log('\n📊 Statistics:');
      console.log('Total Channels:', totalChannels);
      console.log('Channels with Video Title:', withVideoTitle);
      console.log('Channels without Video Title:', totalChannels - withVideoTitle);
    } else {
      console.log('⚠️  No cached channels found');
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkCache();
