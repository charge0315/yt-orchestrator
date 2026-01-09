const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// backend の .env を読み込む
dotenv.config({ path: path.resolve(__dirname, '..', 'packages', 'backend', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in packages/backend/.env');
  process.exit(1);
}

// 実行オプション: --dry でプレビュー（更新しない）
const args = process.argv.slice(2);
const DRY = args.includes('--dry');

async function main() {
  await mongoose.connect(MONGODB_URI, { dbName: 'yt-orchestrator' });
  console.log('Connected to MongoDB');

  const User = require(path.resolve(__dirname, '..', 'packages', 'backend', 'dist', 'models', 'User.js')).User;
  const CachedChannel = require(path.resolve(__dirname, '..', 'packages', 'backend', 'dist', 'models', 'CachedChannel.js')).CachedChannel;
  const CachedPlaylist = require(path.resolve(__dirname, '..', 'packages', 'backend', 'dist', 'models', 'CachedPlaylist.js')).CachedPlaylist;

  const user = await User.findOne({ youtubeAccessToken: { $exists: true, $ne: null } }).lean();
  if (!user) {
    console.log('No user with youtubeAccessToken found');
    await mongoose.disconnect();
    return;
  }

  console.log('Target user:', { googleId: user.googleId, email: user.email });
  const userId = user.googleId;

  const channelBefore = await CachedChannel.countDocuments({ userId, isArtist: { $in: [null, undefined] } });
  const playlistBefore = await CachedPlaylist.countDocuments({ userId, isMusicPlaylist: { $in: [null, undefined] } });

  console.log(`Will affect CachedChannel entries with null isArtist: ${channelBefore}`);
  console.log(`Will affect CachedPlaylist entries with null isMusicPlaylist: ${playlistBefore}`);

  if (DRY) {
    console.log('Dry run complete. No changes were made.');
    await mongoose.disconnect();
    return;
  }

  // 実更新
  const channelResult = await CachedChannel.updateMany(
    { userId, isArtist: { $in: [null, undefined] } },
    { $set: { isArtist: true, cachedAt: new Date() } }
  );

  const playlistResult = await CachedPlaylist.updateMany(
    { userId, isMusicPlaylist: { $in: [null, undefined] } },
    { $set: { isMusicPlaylist: true, cachedAt: new Date() } }
  );

  const chModified = channelResult.modifiedCount ?? channelResult.nModified ?? 0;
  const plModified = playlistResult.modifiedCount ?? playlistResult.nModified ?? 0;

  console.log(`Updated CachedChannel modified: ${chModified}`);
  console.log(`Updated CachedPlaylist modified: ${plModified}`);

  const channelAfter = await CachedChannel.countDocuments({ userId, isArtist: { $in: [null, undefined] } });
  const playlistAfter = await CachedPlaylist.countDocuments({ userId, isMusicPlaylist: { $in: [null, undefined] } });

  console.log(`Remaining CachedChannel with null isArtist: ${channelAfter}`);
  console.log(`Remaining CachedPlaylist with null isMusicPlaylist: ${playlistAfter}`);

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
