const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', 'packages', 'backend', '.env') });
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI, { dbName: 'yt-orchestrator' });
  const User = require(path.resolve(__dirname, '..', 'packages', 'backend', 'dist', 'models', 'User.js')).User;
  const CachedChannel = require(path.resolve(__dirname, '..', 'packages', 'backend', 'dist', 'models', 'CachedChannel.js')).CachedChannel;
  const CachedPlaylist = require(path.resolve(__dirname, '..', 'packages', 'backend', 'dist', 'models', 'CachedPlaylist.js')).CachedPlaylist;

  const user = await User.findOne({ youtubeAccessToken: { $exists: true, $ne: null } }).lean();
  if (!user) {
    console.log('No user with youtubeAccessToken found');
    await mongoose.disconnect();
    return;
  }
  const userId = user.googleId;

  const ytmusicPlaylists = await CachedPlaylist.find({ userId, isMusicPlaylist: true }).sort({ cachedAt: -1 }).lean();
  const artists = await CachedChannel.find({ userId, isArtist: true }).sort({ channelTitle: 1 }).lean();
  const allPlaylists = await CachedPlaylist.find({ userId }).sort({ cachedAt: -1 }).lean();

  console.log('=== ytmusic/playlists (formatted) ===');
  console.log(JSON.stringify(ytmusicPlaylists.slice(0, 20).map(pl => ({
    id: pl.playlistId,
    title: pl.title,
    description: pl.description,
    thumbnail: pl.thumbnailUrl,
    channelId: pl.channelId,
    itemCount: pl.itemCount,
  })), null, 2));

  console.log('\n=== artists (formatted) ===');
  console.log(JSON.stringify(artists.slice(0, 20).map(ch => ({
    channelId: ch.channelId,
    title: ch.channelTitle,
    latestVideoId: ch.latestVideoId,
    latestVideoTitle: ch.latestVideoTitle,
    thumbnail: ch.thumbnailUrl,
  })), null, 2));

  console.log('\n=== playlists (cached, formatted) ===');
  console.log(JSON.stringify(allPlaylists.slice(0, 20).map(pl => ({
    id: pl.playlistId,
    title: pl.title,
    isMusicPlaylist: pl.isMusicPlaylist,
    thumbnail: pl.thumbnailUrl,
    itemCount: pl.itemCount,
  })), null, 2));

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
