/**
 * YouTube動画プレイリストルート
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/youtube/playlists
 * YouTube動画プレイリスト一覧を取得（音楽系を除外）
 * クエリパラメータ: pageToken (オプション)
 */
router.get('/playlists', async (req: AuthRequest, res: Response) => {
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

    // 音楽プレイリストを除外（動画プレイリストのみ）
    const videoPlaylists = playlistChecks
      .filter(({ isMusic }) => !isMusic)
      .map(({ playlist }) => playlist);

    res.json({
      items: videoPlaylists,
      nextPageToken: result.nextPageToken
    });
  } catch (error) {
    console.error('Error fetching YouTube playlists:', error);
    res.json({ items: [], nextPageToken: undefined });
  }
});

/**
 * GET /api/youtube/search
 * 動画を検索
 * クエリパラメータ: query (必須), maxResults (オプション、デフォルト10)
 */
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { query, maxResults } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const results = await ytService.searchVideos(query, maxResults ? parseInt(maxResults as string) : 10); // デフォルト10に削減

    res.json(results);
  } catch (error) {
    console.error('Error searching videos:', error);
    res.json([]);
  }
});

export default router;
