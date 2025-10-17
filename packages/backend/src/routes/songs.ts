/**
 * 曲検索ルート
 * YouTube Data API v3を使用して動画/曲を検索
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';

const router = express.Router();

/**
 * GET /api/songs/search
 * キーワードで曲/動画を検索
 */
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // YouTube Data API v3で検索
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const results = await ytService.searchVideos(query, 25);

    // レスポンス形式を整形
    const transformedResults = results.map((video: any) => ({
      videoId: video.id?.videoId,
      title: video.snippet?.title,
      artist: video.snippet?.channelTitle || 'Unknown Artist',
      thumbnail: video.snippet?.thumbnails?.default?.url || video.snippet?.thumbnails?.medium?.url
    }));

    res.json({
      results: transformedResults
    });
  } catch (error) {
    console.error('Error searching songs:', error);
    res.status(500).json({ error: 'Failed to search songs' });
  }
});

export default router;
