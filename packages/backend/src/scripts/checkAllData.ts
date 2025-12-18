/**
 * MongoDB全データ確認スクリプト
 * 登録されているユーザー、チャンネル、プレイリスト、AIおすすめなどの情報を表示
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase } from '../config/database.js';
import mongoose from 'mongoose';

async function checkAllData() {
  await connectDatabase();

  console.log('=== MongoDB データベース状態確認 ===\n');

  const db = mongoose.connection.db;
  if (!db) {
    console.error('MongoDB の database ハンドルを取得できません');
    await mongoose.disconnect();
    process.exit(1);
    return;
  }

  // 全コレクションを取得
  const collections = await db.listCollections().toArray();

  console.log('📚 利用可能なコレクション:');
  for (const collection of collections) {
    const count = await db.collection(collection.name).countDocuments();
    console.log(`  - ${collection.name}: ${count}件`);
  }

  console.log('\n=== 詳細データ ===\n');

  // ユーザー情報
  const users = await db.collection('users').find({}).toArray();
  console.log(`👤 ユーザー (${users.length}件):`);
  users.forEach((u: any) => {
    console.log(`  - ${u.email || u.googleId}`);
    console.log(`    Google ID: ${u.googleId}`);
    console.log(`    YouTubeトークン: ${u.youtubeAccessToken ? '✓ 有効' : '✗ なし'}`);
    if (u.youtubeTokenExpiry) {
      const expired = new Date(u.youtubeTokenExpiry) < new Date();
      console.log(`    トークン期限: ${new Date(u.youtubeTokenExpiry).toISOString()} ${expired ? '(期限切れ)' : '(有効)'}`);
    }
  });

  // チャンネル情報
  const channels = await db.collection('channels').find({}).limit(10).toArray();
  console.log(`\n📺 チャンネル (全体: ${await db.collection('channels').countDocuments()}件, 表示: 最大10件):`);
  channels.forEach((c: any) => {
    console.log(`  - ${c.title || c.channelTitle}`);
    console.log(`    ID: ${c.channelId}`);
    console.log(`    ユーザーID: ${c.userId}`);
  });

  // プレイリスト情報
  const playlists = await db.collection('playlists').find({}).limit(10).toArray();
  console.log(`\n📝 プレイリスト (全体: ${await db.collection('playlists').countDocuments()}件, 表示: 最大10件):`);
  playlists.forEach((p: any) => {
    console.log(`  - ${p.title}`);
    console.log(`    ID: ${p.playlistId}`);
    console.log(`    アイテム数: ${p.itemCount || 0}`);
    console.log(`    ユーザーID: ${p.userId}`);
  });

  // キャッシュチャンネル
  const cachedChannels = await db.collection('cachedchannels').find({}).limit(10).toArray();
  console.log(`\n🗄️ キャッシュチャンネル (全体: ${await db.collection('cachedchannels').countDocuments()}件, 表示: 最大10件):`);
  cachedChannels.forEach((c: any) => {
    console.log(`  - ${c.channelTitle}`);
    console.log(`    アーティスト: ${c.isArtist ? '✓' : '✗'}`);
    console.log(`    最新動画: ${c.latestVideoTitle || 'なし'}`);
    console.log(`    更新日時: ${c.cachedAt ? new Date(c.cachedAt).toISOString() : 'なし'}`);
  });

  // キャッシュプレイリスト
  const cachedPlaylists = await db.collection('cachedplaylists').find({}).limit(10).toArray();
  console.log(`\n🗄️ キャッシュプレイリスト (全体: ${await db.collection('cachedplaylists').countDocuments()}件, 表示: 最大10件):`);
  cachedPlaylists.forEach((p: any) => {
    console.log(`  - ${p.title}`);
    console.log(`    音楽プレイリスト: ${p.isMusicPlaylist ? '✓' : '✗'}`);
    console.log(`    アイテム数: ${p.itemCount || 0}`);
    console.log(`    更新日時: ${p.cachedAt ? new Date(p.cachedAt).toISOString() : 'なし'}`);
  });

  // AIおすすめ（存在する場合）
  const hasRecommendations = collections.some(c => c.name === 'recommendations');
  if (hasRecommendations) {
    const recommendations = await db.collection('recommendations').find({}).limit(10).toArray();
    console.log(`\n🤖 AIおすすめ (全体: ${await db.collection('recommendations').countDocuments()}件, 表示: 最大10件):`);
    recommendations.forEach((r: any) => {
      console.log(`  - ${r.title || r.name}`);
      console.log(`    ユーザーID: ${r.userId}`);
      console.log(`    作成日時: ${r.createdAt ? new Date(r.createdAt).toISOString() : 'なし'}`);
    });
  } else {
    console.log('\n🤖 AIおすすめ: コレクションなし');
  }

  console.log('\n✅ 確認完了');
  process.exit(0);
}

checkAllData().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
