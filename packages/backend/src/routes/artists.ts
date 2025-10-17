/**
 * アーティスト（YouTube Musicチャンネル）管理ルート
 * YouTube Data API v3のチャンネル登録機能を使用
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import { cache } from '../utils/cache.js';

const router = express.Router();

// すべてのルートで認証を必須にする
router.use(authenticate);

/**
 * GET /api/artists
 * 登録中のアーティスト（チャンネル）一覧を取得
 * 各アーティストの最新動画のサムネイルも含める
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const cacheKey = `artists:${req.userId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const subscriptions = await ytService.getSubscriptions();

    // 各チャンネルの最新動画のサムネイルを取得
    const enrichedSubscriptions = await Promise.all(
      subscriptions.map(async (sub: any) => {
        try {
          const channelId = sub.snippet?.resourceId?.channelId;
          if (channelId) {
            const videos = await ytService.getChannelVideos(channelId, 1);
            if (videos.length > 0) {
              const latestVideo = videos[0];
              return {
                ...sub,
                latestVideoThumbnail: latestVideo.snippet?.thumbnails?.high?.url ||
                                     latestVideo.snippet?.thumbnails?.medium?.url ||
                                     latestVideo.snippet?.thumbnails?.default?.url
              };
            }
          }
        } catch (error) {
          console.error(`Failed to fetch latest video for artist ${sub.snippet?.title}:`, error);
        }
        return sub;
      })
    );

    cache.set(cacheKey, enrichedSubscriptions, 10 * 60 * 1000); // 10分キャッシュ
    res.json(enrichedSubscriptions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

/**
 * POST /api/artists
 * アーティスト（チャンネル）を登録
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { channelId } = req.body;
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const subscription = await ytService.subscribe(channelId);
    res.status(201).json(subscription);
  } catch (error) {
    res.status(500).json({ error: 'Failed to subscribe to artist' });
  }
});

/**
 * DELETE /api/artists/:id
 * アーティスト（チャンネル）の登録を解除
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    await ytService.unsubscribe(req.params.id);
    res.json({ message: 'Unsubscribed from artist successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe from artist' });
  }
});

/**
 * GET /api/artists/new-releases
 * 登録アーティストの最新動画を取得
 */
router.get('/new-releases', async (req: AuthRequest, res: Response) => {
  try {
    const cacheKey = `new-releases:${req.userId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const subscriptions = await ytService.getSubscriptions();
    const allNewReleases = [];

    // 各チャンネルの最新動画を取得（最大5件ずつ）
    for (const sub of subscriptions) {
      const channelId = sub.snippet?.resourceId?.channelId;
      if (channelId) {
        const videos = await ytService.getChannelVideos(channelId, 5);
        allNewReleases.push(...videos);
      }
    }
    
    cache.set(cacheKey, allNewReleases, 5 * 60 * 1000); // 5分キャッシュ
    res.json(allNewReleases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch new releases' });
  }
});

export default router;
