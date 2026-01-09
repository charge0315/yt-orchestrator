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

async function main() {
  await mongoose.connect(MONGODB_URI, { dbName: 'yt-orchestrator' });
  console.log('Connected to MongoDB');

  // require built models from dist
  const User = require(path.resolve(__dirname, '..', 'packages', 'backend', 'dist', 'models', 'User.js')).User;
  const CachedChannel = require(path.resolve(__dirname, '..', 'packages', 'backend', 'dist', 'models', 'CachedChannel.js')).CachedChannel;
  const CachedPlaylist = require(path.resolve(__dirname, '..', 'packages', 'backend', 'dist', 'models', 'CachedPlaylist.js')).CachedPlaylist;

  const user = await User.findOne({ youtubeAccessToken: { $exists: true, $ne: null } }).lean();
  if (!user) {
    console.log('No user with youtubeAccessToken found');
    await mongoose.disconnect();
    return;
  }

  console.log('Found user:', { googleId: user.googleId, email: user.email, reauthRequired: user.reauthRequired || false });

  const userId = user.googleId;
  const channelCount = await CachedChannel.countDocuments({ userId });
  const playlistCount = await CachedPlaylist.countDocuments({ userId });

  console.log(`CachedChannel count=${channelCount}, CachedPlaylist count=${playlistCount}`);

  const sampleChannels = await CachedChannel.find({ userId }).limit(10).lean();
  const samplePlaylists = await CachedPlaylist.find({ userId }).limit(10).lean();

  console.log('\nSample CachedChannels:');
  sampleChannels.forEach(c => {
    console.log({ channelTitle: c.channelTitle, channelId: c.channelId, isArtist: c.isArtist, latestVideoId: c.latestVideoId });
  });

  console.log('\nSample CachedPlaylists:');
  samplePlaylists.forEach(p => {
    console.log({ title: p.title, playlistId: p.playlistId, isMusicPlaylist: p.isMusicPlaylist });
  });

  // check reauthRequired
  if (user.reauthRequired) {
    console.log('\nUser requires reauth:', user.reauthReason || 'unknown');
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
