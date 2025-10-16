import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import Playlist from '../models/Playlist.js';
import YouTubePlaylist from '../models/YouTubePlaylist.js';

dotenv.config();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// ユーザーID（認証済みのユーザー）
const USER_ID = '68f0c2fce8882ec4082c8781';

interface YouTubeVideoSnippet {
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnails: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
    maxres?: { url: string };
  };
}

interface YouTubePlaylistItem {
  id: string;
  snippet: YouTubeVideoSnippet;
  contentDetails?: {
    videoId: string;
  };
}

async function searchYouTubeMusicPlaylists() {
  try {
    console.log('🎵 Searching for YouTube Music playlists...');

    // 人気の音楽プレイリストを検索
    const response = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        part: 'snippet',
        q: 'J-POP playlist',
        type: 'playlist',
        maxResults: 5,
        key: YOUTUBE_API_KEY
      }
    });

    const playlists = response.data.items;
    console.log(`✅ Found ${playlists.length} music playlists`);

    for (const playlist of playlists) {
      const playlistId = playlist.id.playlistId;

      // プレイリスト内の動画を取得
      const videosResponse = await axios.get(`${YOUTUBE_API_BASE}/playlistItems`, {
        params: {
          part: 'snippet,contentDetails',
          playlistId: playlistId,
          maxResults: 10,
          key: YOUTUBE_API_KEY
        }
      });

      const videos = videosResponse.data.items;
      const songs = videos.map((video: YouTubePlaylistItem) => ({
        videoId: video.contentDetails?.videoId || video.id,
        title: video.snippet.title,
        artist: video.snippet.channelTitle,
        thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
        addedAt: new Date()
      }));

      // データベースに保存（ユーザーIDを付与）
      const newPlaylist = new Playlist({
        name: playlist.snippet.title,
        description: playlist.snippet.description,
        songs: songs,
        userId: USER_ID
      });

      await newPlaylist.save();
      console.log(`  ✅ Saved: ${playlist.snippet.title} (${songs.length} songs)`);
    }
  } catch (error: any) {
    console.error('❌ Error fetching music playlists:', error.response?.data || error.message);
  }
}

async function searchYouTubePlaylists() {
  try {
    console.log('▶️ Searching for YouTube video playlists...');

    // 人気の動画プレイリストを検索
    const response = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        part: 'snippet',
        q: '日本のバラエティ番組',
        type: 'playlist',
        maxResults: 5,
        key: YOUTUBE_API_KEY
      }
    });

    const playlists = response.data.items;
    console.log(`✅ Found ${playlists.length} video playlists`);

    for (const playlist of playlists) {
      const playlistId = playlist.id.playlistId;

      // プレイリスト内の動画を取得
      const videosResponse = await axios.get(`${YOUTUBE_API_BASE}/playlistItems`, {
        params: {
          part: 'snippet,contentDetails',
          playlistId: playlistId,
          maxResults: 10,
          key: YOUTUBE_API_KEY
        }
      });

      const videos = videosResponse.data.items;
      const videoList = videos.map((video: YouTubePlaylistItem) => ({
        videoId: video.contentDetails?.videoId || video.id,
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
        publishedAt: new Date(video.snippet.publishedAt),
        addedAt: new Date()
      }));

      // データベースに保存（ユーザーIDを付与）
      const newPlaylist = new YouTubePlaylist({
        name: playlist.snippet.title,
        description: playlist.snippet.description,
        videos: videoList,
        userId: USER_ID
      });

      await newPlaylist.save();
      console.log(`  ✅ Saved: ${playlist.snippet.title} (${videoList.length} videos)`);
    }
  } catch (error: any) {
    console.error('❌ Error fetching video playlists:', error.response?.data || error.message);
  }
}

async function main() {
  try {
    console.log('🚀 Starting data seeding...\n');

    // MongoDBに接続
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yt-orchestrator');
    console.log('✅ Connected to MongoDB\n');

    // 既存のデータを削除
    await Playlist.deleteMany({});
    await YouTubePlaylist.deleteMany({});
    console.log('🗑️  Cleared existing data\n');

    // YouTube APIからデータを取得して保存
    await searchYouTubeMusicPlaylists();
    console.log('');
    await searchYouTubePlaylists();

    console.log('\n✅ Data seeding completed!');

    // 結果を確認
    const musicCount = await Playlist.countDocuments();
    const youtubeCount = await YouTubePlaylist.countDocuments();
    console.log(`\n📊 Summary:`);
    console.log(`   Music Playlists: ${musicCount}`);
    console.log(`   YouTube Playlists: ${youtubeCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

main();
