/**
 * MongoDBプレイリストキャッシュデータの確認スクリプト
 */
import mongoose from 'mongoose';
import { CachedPlaylist } from '../models/CachedPlaylist.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkPlaylists() {
  try {
    // MongoDB接続
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yt-orchestrator';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB に接続しました');

    // サンプルプレイリストを1件取得
    const playlist = await CachedPlaylist.findOne().lean();

    if (playlist) {
      console.log('\n📋 サンプルプレイリストデータ:');
      console.log('タイトル:', playlist.title);
      console.log('サムネイルURL:', playlist.thumbnailUrl);
      console.log('プレイリストID:', playlist.playlistId);
      console.log('アイテム数:', playlist.itemCount);
      console.log('キャッシュ日時:', playlist.cachedAt);

      // 全プレイリストの統計
      const totalPlaylists = await CachedPlaylist.countDocuments();
      const withThumbnail = await CachedPlaylist.countDocuments({
        thumbnailUrl: { $exists: true, $nin: [null, ''] }
      });

      console.log('\n📊 統計:');
      console.log('総プレイリスト数:', totalPlaylists);
      console.log('サムネイルあり:', withThumbnail);
      console.log('サムネイルなし:', totalPlaylists - withThumbnail);
    } else {
      console.log('⚠️  キャッシュされたプレイリストが見つかりません');
    }

    await mongoose.disconnect();
    console.log('\n✅ 完了');
    process.exit(0);
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

checkPlaylists();
