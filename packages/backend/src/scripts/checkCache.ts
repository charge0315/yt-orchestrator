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
    console.log('✅ MongoDB に接続しました');

    // サンプルチャンネルを1件取得
    const channel = await CachedChannel.findOne().lean();

    if (channel) {
      console.log('\n📋 サンプルチャンネルデータ:');
      console.log('チャンネル名:', channel.channelTitle);
      console.log('最新動画タイトル:', channel.latestVideoTitle);
      console.log('最新動画ID:', channel.latestVideoId);
      console.log('最新サムネイル:', channel.latestVideoThumbnail);
      console.log('キャッシュ日時:', channel.cachedAt);

      // 全チャンネルの統計
      const totalChannels = await CachedChannel.countDocuments();
      const withVideoTitle = await CachedChannel.countDocuments({
        latestVideoTitle: { $exists: true, $ne: null }
      });

      console.log('\n📊 統計:');
      console.log('総チャンネル数:', totalChannels);
      console.log('動画タイトルあり:', withVideoTitle);
      console.log('動画タイトルなし:', totalChannels - withVideoTitle);
    } else {
      console.log('⚠️  キャッシュされたチャンネルが見つかりません');
    }

    await mongoose.disconnect();
    console.log('\n✅ 完了');
    process.exit(0);
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

checkCache();
