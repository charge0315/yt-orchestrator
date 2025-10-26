/**
 * アーティスト（YouTube Music想定チャンネル）ルーター
 * - 24時間キャッシュ優先
 * - 必要時のみYouTube APIを呼び出し（別要件により1日1回制限に対応）
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import { CachedChannel } from '../models/CachedChannel.js';

const router = express.Router();

router.use(authenticate);

// GET /api/artists
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const cachedDocs = await CachedChannel.find({ userId: req.userId }).sort({ cachedAt: -1 }).lean();
    const formatted = cachedDocs.map((ch: any) => ({
      id: ch.subscriptionId || ch.channelId,
      snippet: {
        resourceId: { channelId: ch.channelId },
        title: ch.channelTitle,
        description: ch.channelDescription,
        thumbnails: {
          default: { url: ch.thumbnailUrl },
          medium: { url: ch.thumbnailUrl },
          high: { url: ch.thumbnailUrl }
        }
      },
      latestVideoThumbnail: ch.latestVideoThumbnail,
      latestVideoTitle: ch.latestVideoTitle,
      latestVideoId: ch.latestVideoId,
      latestVideoPublishedAt: ch.latestVideoPublishedAt
    }));

    return res.json(formatted);
  } catch (error) {
    console.error('Failed to get artists (Mongo only):', error);
    res.status(500).json({ error: 'Failed to get artists' });
  }
});

// POST /api/artists
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { channelId } = req.body;
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const subscription = await yt.subscribe(channelId);
    res.status(201).json(subscription);
  } catch {
    res.status(500).json({ error: 'Failed to subscribe to artist' });
  }
});

// DELETE /api/artists/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    await yt.unsubscribe(req.params.id);
    res.json({ message: 'Unsubscribed from artist successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to unsubscribe from artist' });
  }
});

// GET /api/artists/new-releases
router.get('/new-releases', async (req: AuthRequest, res: Response) => {
  try {
    const cached = await CachedChannel.find({
      userId: req.userId,
      latestVideoId: { $exists: true, $ne: null },
    })
      .sort({ latestVideoPublishedAt: -1, cachedAt: -1 })
      .limit(20)
      .lean();

    // もし最新動画が見つからない場合は、最新更新順のチャンネル情報のみを返す
    const fallbackChannels =
      cached.length > 0
        ? []
        : await CachedChannel.find({ userId: req.userId })
            .sort({ cachedAt: -1 })
            .limit(20)
            .lean();

    const source = cached.length > 0 ? cached : fallbackChannels;

    const newReleases = source.map((ch: any) => {
      const videoId = ch.latestVideoId ?? null;
      return {
        id: { videoId: videoId ?? ch.channelId },
        videoId,
        snippet: {
          channelId: ch.channelId,
          channelTitle: ch.channelTitle,
          title: ch.latestVideoTitle || ch.channelTitle,
          thumbnails: {
            default: { url: ch.latestVideoThumbnail || ch.thumbnailUrl },
            medium: { url: ch.latestVideoThumbnail || ch.thumbnailUrl },
            high: { url: ch.latestVideoThumbnail || ch.thumbnailUrl },
          },
          publishedAt: ch.latestVideoPublishedAt || ch.cachedAt,
        },
        title: ch.latestVideoTitle || ch.channelTitle,
        thumbnail: ch.latestVideoThumbnail || ch.thumbnailUrl,
        isArtist: ch.isArtist === true,
      }
    });

    return res.json(newReleases);
  } catch (error) {
    console.error('Failed to get new releases (Mongo only):', error);
    res.status(500).json({ error: 'Failed to get new releases' });
  }
});

export default router;
