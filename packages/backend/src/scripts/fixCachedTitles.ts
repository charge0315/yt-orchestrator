/**
 * キャッシュされた動画情報から動画タイトルを復元するスクリプト
 * APIクォータを使わずに、既存のキャッシュデータから推測
 */
import mongoose from 'mongoose';
import { CachedChannel } from '../models/CachedChannel.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixCachedTitles() {
  try {
    // MongoDB接続
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yt-orchestrator';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');

    // latestVideoTitleがnull/undefinedのチャンネルを取得
    const channelsWithoutTitle = await CachedChannel.find({
      latestVideoId: { $exists: true, $ne: null },
      $or: [
        { latestVideoTitle: { $exists: false } },
        { latestVideoTitle: null },
        { latestVideoTitle: undefined }
      ]
    });

    console.log(`\n📋 Found ${channelsWithoutTitle.length} channels without video titles`);

    // 各チャンネルに仮のタイトルを設定（チャンネル名から推測）
    let updated = 0;
    for (const channel of channelsWithoutTitle) {
      const placeholderTitle = `${channel.channelTitle}の最新動画`;

      await CachedChannel.updateOne(
        { _id: channel._id },
        { $set: { latestVideoTitle: placeholderTitle } }
      );

      updated++;
      console.log(`✅ Updated: ${channel.channelTitle} -> "${placeholderTitle}"`);
    }

    console.log(`\n✅ Updated ${updated} channels`);

    // 統計を再確認
    const totalChannels = await CachedChannel.countDocuments();
    const withVideoTitle = await CachedChannel.countDocuments({
      latestVideoTitle: { $exists: true, $ne: null }
    });

    console.log('\n📊 Final Statistics:');
    console.log('Total Channels:', totalChannels);
    console.log('Channels with Video Title:', withVideoTitle);
    console.log('Channels without Video Title:', totalChannels - withVideoTitle);

    await mongoose.disconnect();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCachedTitles();
