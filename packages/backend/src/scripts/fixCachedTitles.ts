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
    console.log('✅ MongoDB に接続しました');

    // latestVideoTitleがnull/undefinedのチャンネルを取得
    const channelsWithoutTitle = await CachedChannel.find({
      latestVideoId: { $exists: true, $ne: null },
      $or: [
        { latestVideoTitle: { $exists: false } },
        { latestVideoTitle: null },
        { latestVideoTitle: undefined }
      ]
    });

    console.log(`\n📋 動画タイトルが未設定のチャンネルを ${channelsWithoutTitle.length} 件見つけました`);

    // 各チャンネルに仮のタイトルを設定（チャンネル名から推測）
    let updated = 0;
    for (const channel of channelsWithoutTitle) {
      const placeholderTitle = `${channel.channelTitle}の最新動画`;

      await CachedChannel.updateOne(
        { _id: channel._id },
        { $set: { latestVideoTitle: placeholderTitle } }
      );

      updated++;
      console.log(`✅ 更新: ${channel.channelTitle} -> "${placeholderTitle}"`);
    }

    console.log(`\n✅ ${updated} 件のチャンネルを更新しました`);

    // 統計を再確認
    const totalChannels = await CachedChannel.countDocuments();
    const withVideoTitle = await CachedChannel.countDocuments({
      latestVideoTitle: { $exists: true, $ne: null }
    });

    console.log('\n📊 最終統計:');
    console.log('総チャンネル数:', totalChannels);
    console.log('動画タイトルあり:', withVideoTitle);
    console.log('動画タイトルなし:', totalChannels - withVideoTitle);

    await mongoose.disconnect();
    console.log('\n✅ 完了');
    process.exit(0);
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

fixCachedTitles();
