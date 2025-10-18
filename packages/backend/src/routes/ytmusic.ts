/**
 * YouTube Music互換ルート
 * YouTube Data API v3を使用してYouTube Musicの機能を提供
 * 注: YouTube MusicはYouTubeの一部なので、同じAPIを使用できます
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';

const router = express.Router();

/**
 * GET /api/ytmusic/auth/status
 * YouTube Music接続状態を確認
 * 注: YouTube Data APIを使用しているため、常に接続済み
 */
router.get('/auth/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // YouTube Data API v3を使用しているため、
    // Google OAuthが完了していれば自動的に接続済み
    res.json({
      connected: true,
      message: 'YouTube Data API v3を使用しています'
    });
  } catch (error) {
    console.error('Error checking YouTube Music status:', error);
    res.status(500).json({ error: 'Failed to check YouTube Music status' });
  }
});

/**
 * GET /api/ytmusic/playlists
 * YouTube Musicプレイリスト一覧を取得
 * プレイリスト内の動画のカテゴリIDをチェックして音楽系のもののみをフィルタリング
 * クエリパラメータ: pageToken (オプション)
 */
router.get('/playlists', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { pageToken } = req.query;
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const result = await ytService.getPlaylists(pageToken as string | undefined);

    // 各プレイリストを非同期で判定（並列処理）
    const playlistChecks = await Promise.all(
      result.items.map(async (playlist: any) => ({
        playlist,
        isMusic: await ytService.isMusicPlaylistAsync(playlist.id)
      }))
    );

    // 音楽プレイリストのみをフィルタリング
    const musicPlaylists = playlistChecks
      .filter(({ isMusic }) => isMusic)
      .map(({ playlist }) => playlist);

    res.json({
      items: musicPlaylists,
      nextPageToken: result.nextPageToken
    });
  } catch (error: any) {
    console.error('Error fetching YouTube Music playlists:', error);
    res.json({ items: [], nextPageToken: undefined });
  }
});

/**
 * GET /api/ytmusic/playlists/:id
 * 特定のプレイリストの詳細を取得
 */
router.get('/playlists/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const playlist = await ytService.getPlaylist(req.params.id);

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // プレイリストのアイテムも取得
    const itemsResult = await ytService.getPlaylistItems(req.params.id);

    const transformedPlaylist = {
      _id: playlist.id,
      name: playlist.snippet?.title || '',
      description: playlist.snippet?.description || '',
      thumbnail: playlist.snippet?.thumbnails?.default?.url,
      songs: itemsResult.items.map((item: any) => ({
        videoId: item.snippet?.resourceId?.videoId,
        title: item.snippet?.title,
        artist: item.snippet?.videoOwnerChannelTitle || 'Unknown Artist',
        thumbnail: item.snippet?.thumbnails?.default?.url,
        addedAt: new Date(item.snippet?.publishedAt)
      })),
      createdAt: new Date(playlist.snippet?.publishedAt),
      updatedAt: new Date()
    };

    res.json(transformedPlaylist);
  } catch (error) {
    console.error('Error fetching YouTube Music playlist:', error);
    res.status(500).json({ error: 'Failed to fetch YouTube Music playlist' });
  }
});

/**
 * GET /api/ytmusic/search
 * 動画を検索（YouTube Musicとして）
 */
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);

    // YouTube Data APIのsearch機能を使用
    // 音楽カテゴリ（categoryId=10）でフィルタリング
    const results = await ytService.searchVideos(query, 20);

    const transformedResults = results.map((video: any) => ({
      videoId: video.id?.videoId,
      title: video.snippet?.title,
      artist: video.snippet?.channelTitle || 'Unknown Artist',
      thumbnail: video.snippet?.thumbnails?.default?.url
    }));

    res.json(transformedResults);
  } catch (error) {
    console.error('Error searching YouTube Music:', error);
    res.status(500).json({ error: 'Failed to search YouTube Music' });
  }
});

export default router;
