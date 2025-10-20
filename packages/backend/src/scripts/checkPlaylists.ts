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
    console.log('✅ MongoDB connected');

    // サンプルプレイリストを1件取得
    const playlist = await CachedPlaylist.findOne().lean();

    if (playlist) {
      console.log('\n📋 Sample Playlist Data:');
      console.log('Title:', playlist.title);
      console.log('Thumbnail URL:', playlist.thumbnailUrl);
      console.log('Playlist ID:', playlist.playlistId);
      console.log('Item Count:', playlist.itemCount);
      console.log('Cached At:', playlist.cachedAt);

      // 全プレイリストの統計
      const totalPlaylists = await CachedPlaylist.countDocuments();
      const withThumbnail = await CachedPlaylist.countDocuments({
        thumbnailUrl: { $exists: true, $ne: null, $ne: '' }
      });

      console.log('\n📊 Statistics:');
      console.log('Total Playlists:', totalPlaylists);
      console.log('Playlists with Thumbnail:', withThumbnail);
      console.log('Playlists without Thumbnail:', totalPlaylists - withThumbnail);
    } else {
      console.log('⚠️  No cached playlists found');
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkPlaylists();
