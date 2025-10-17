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
 */
router.get('/playlists', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const allPlaylists = await ytService.getPlaylists();

    const videoPlaylists = allPlaylists.filter((playlist: any) =>
      !ytService.isMusicPlaylist(playlist)
    );

    res.json(videoPlaylists);
  } catch (error) {
    console.error('Error fetching YouTube playlists:', error);
    res.json([]);
  }
});

/**
 * GET /api/youtube/search
 * 動画を検索
 */
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { query, maxResults } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const results = await ytService.searchVideos(query, maxResults ? parseInt(maxResults as string) : 20);

    res.json(results);
  } catch (error) {
    console.error('Error searching videos:', error);
    res.json([]);
  }
});

export default router;
