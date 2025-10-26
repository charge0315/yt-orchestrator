/**
 * 初期データ投入ユーティリティ
 * MongoDB が空の場合にデモ用のキャッシュデータを投入する
 */
import mongoose from 'mongoose'
import { CachedChannel } from '../models/CachedChannel.js'
import { CachedPlaylist } from '../models/CachedPlaylist.js'
import { Playlist } from '../models/Playlist.js'
import { User } from '../models/User.js'

const SEED_DISABLED_FLAG = '1'

interface SeedResult {
  createdUsers: number
  createdChannels: number
  createdCachedPlaylists: number
  createdPlaylists: number
}

/**
 * MongoDB にデモ用初期データを投入する
 * すでにドキュメントが存在する場合は投入しない
 */
export async function seedInitialData(): Promise<SeedResult | null> {
  if (process.env.DISABLE_DB_SEED === SEED_DISABLED_FLAG) {
    console.log('🛑 MongoDB seed skipped: DISABLE_DB_SEED=1')
    return null
  }

  if (mongoose.connection.readyState !== 1) {
    console.warn('⚠️ MongoDB seed skipped: connection not ready')
    return null
  }

  const [channelCount, cachedPlaylistCount, playlistCount, userCount] = await Promise.all([
    CachedChannel.estimatedDocumentCount().catch(() => 0),
    CachedPlaylist.estimatedDocumentCount().catch(() => 0),
    Playlist.estimatedDocumentCount().catch(() => 0),
    User.estimatedDocumentCount().catch(() => 0),
  ])

  if (channelCount > 0 || cachedPlaylistCount > 0 || playlistCount > 0 || userCount > 0) {
    console.log('ℹ️ MongoDB seed skipped: existing data detected')
    return null
  }

  const seedUserId = process.env.SEED_USER_ID || 'demo-user'
  const seedUserEmail = process.env.SEED_USER_EMAIL || 'demo@example.com'
  const now = new Date()

  const demoChannels = [
    {
      userId: seedUserId,
      channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
      channelTitle: 'Google Developers',
      channelDescription: 'The Google Developers channel offers tutorials, best practices, tips, and the latest updates across Google tools and platforms.',
      thumbnailUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKYVf-0ywvxjUYRhZ9wmZsG0OcJCIZy9FHn5Vf2s=s240-c-k-c0x00ffffff-no-rj',
      latestVideoId: 'bIT6Oi7f5bM',
      latestVideoTitle: 'Build better AI apps with Vertex AI',
      latestVideoThumbnail: 'https://i.ytimg.com/vi/bIT6Oi7f5bM/hqdefault.jpg',
      latestVideoPublishedAt: new Date('2024-04-10T12:00:00Z'),
      subscriptionId: 'seed-gd',
      isArtist: false,
      cachedAt: now,
    },
    {
      userId: seedUserId,
      channelId: 'UC29ju8bIPH5as8OGnQzwJyA',
      channelTitle: 'Traversy Media',
      channelDescription: 'Traversy Media features the best web development and programming tutorials on the internet.',
      thumbnailUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKYJ3DQQJ-G6T6riw37ht4cQ-1A9kFWgUUUV0d0m=s240-c-k-c0x00ffffff-no-rj',
      latestVideoId: '1Rs2ND1ryYc',
      latestVideoTitle: 'Tailwind CSS Crash Course',
      latestVideoThumbnail: 'https://i.ytimg.com/vi/1Rs2ND1ryYc/hqdefault.jpg',
      latestVideoPublishedAt: new Date('2024-03-15T15:45:00Z'),
      subscriptionId: 'seed-traversy',
      isArtist: false,
      cachedAt: now,
    },
    {
      userId: seedUserId,
      channelId: 'UCq19-LqvG35A-30oyAiPiqA',
      channelTitle: 'COLORS',
      channelDescription: 'COLORS is a unique aesthetic music platform with a simple, minimalistic approach to showcasing the most distinctive new artists.',
      thumbnailUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKZBB2xO4GZ7a7G-JAn6t8wLYwmKbu6xNARQPcnd=s240-c-k-c0x00ffffff-no-rj',
      latestVideoId: 'jo5y4J1mXT8',
      latestVideoTitle: 'TEMS – Me & U | A COLORS SHOW',
      latestVideoThumbnail: 'https://i.ytimg.com/vi/jo5y4J1mXT8/hqdefault.jpg',
      latestVideoPublishedAt: new Date('2023-10-18T18:00:00Z'),
      subscriptionId: 'seed-colors',
      isArtist: true,
      cachedAt: now,
    },
    {
      userId: seedUserId,
      channelId: 'UCNnnwVSI5Ndo2I4a5kqWm9A',
      channelTitle: '88rising',
      channelDescription: '88rising is a pioneering music company empowering Asian talent globally.',
      thumbnailUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKYzKioEsq2bX7xL7C-JsOvquQWszGxXBJ-LKvfA6Q=s240-c-k-c0x00ffffff-no-rj',
      latestVideoId: 'SwsI5B1BT6U',
      latestVideoTitle: 'Stephanie Poetri - Staying Up (Official Video)',
      latestVideoThumbnail: 'https://i.ytimg.com/vi/SwsI5B1BT6U/hqdefault.jpg',
      latestVideoPublishedAt: new Date('2024-02-21T10:00:00Z'),
      subscriptionId: 'seed-88rising',
      isArtist: true,
      cachedAt: now,
    },
  ]

  const demoCachedPlaylists = [
    {
      userId: seedUserId,
      playlistId: 'PL-osiE80TeTs4_09Xl4tE1WqgG8i3idZu',
      title: 'Node.js Crash Course',
      description: 'A curated list of tutorials to get up to speed with Node.js.',
      thumbnailUrl: 'https://i.ytimg.com/vi/fBNz5xF-Kx4/hqdefault.jpg',
      itemCount: 12,
      channelId: 'UC29ju8bIPH5as8OGnQzwJyA',
      channelTitle: 'Traversy Media',
      privacy: 'public',
      isMusicPlaylist: false,
      cachedAt: now,
    },
    {
      userId: seedUserId,
      playlistId: 'PLFgquLnL59alW3xmYiWRaoz0oM3H17Lth',
      title: 'Today’s Top Hits',
      description: 'Stay up to date with the biggest pop hits around the world.',
      thumbnailUrl: 'https://i.scdn.co/image/ab67706f00000002c52cf2f1f483d880b70dcb63',
      itemCount: 15,
      channelId: 'UC-9-kyTW8ZkZNDHQJ6FgpwQ',
      channelTitle: 'Music',
      privacy: 'public',
      isMusicPlaylist: true,
      cachedAt: now,
    },
  ]

  const demoPlaylistItems = [
    {
      videoId: 'XsX3ATc3FbA',
      title: 'BTS (방탄소년단) \'DNA\' Official MV',
      thumbnail: 'https://i.ytimg.com/vi/XsX3ATc3FbA/mqdefault.jpg',
      addedAt: new Date('2023-07-01T08:00:00Z'),
      position: 0,
    },
    {
      videoId: 'p7ZsBPK656s',
      title: 'Dua Lipa - Houdini (Official Music Video)',
      thumbnail: 'https://i.ytimg.com/vi/p7ZsBPK656s/mqdefault.jpg',
      addedAt: new Date('2023-11-10T08:00:00Z'),
      position: 1,
    },
    {
      videoId: 'HhjHYkPQ8F0',
      title: 'TEMS - Me & U (Official Audio)',
      thumbnail: 'https://i.ytimg.com/vi/HhjHYkPQ8F0/mqdefault.jpg',
      addedAt: new Date('2023-10-06T08:00:00Z'),
      position: 2,
    },
  ]

  const [createdUser] = await User.create([
    {
      googleId: seedUserId,
      email: seedUserEmail,
      name: process.env.SEED_USER_NAME || 'Demo User',
      picture: process.env.SEED_USER_PICTURE,
      reauthRequired: true,
      reauthReason: 'missing',
    },
  ])

  const createdChannels = await CachedChannel.insertMany(demoChannels)
  const createdCachedPlaylists = await CachedPlaylist.insertMany(demoCachedPlaylists)

  const createdPlaylists = await Playlist.insertMany([
    {
      userId: seedUserId,
      playlistId: 'PLFgquLnL59alW3xmYiWRaoz0oM3H17Lth',
      title: 'Today’s Top Hits',
      description: 'Hot tracks from the global charts.',
      thumbnail: 'https://i.scdn.co/image/ab67706f00000002c52cf2f1f483d880b70dcb63',
      itemCount: demoPlaylistItems.length,
      items: demoPlaylistItems,
      isMusicPlaylist: true,
      lastUpdated: now,
    },
  ])

  console.log('✅ Seeded MongoDB with demo data for user:', createdUser.googleId)

  return {
    createdUsers: 1,
    createdChannels: createdChannels.length,
    createdCachedPlaylists: createdCachedPlaylists.length,
    createdPlaylists: createdPlaylists.length,
  }
}

