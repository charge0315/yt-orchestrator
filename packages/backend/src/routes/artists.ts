/**
 * アーティスト（YouTube Musicチャンネル）管理ルート
 * YouTube Data API v3のチャンネル登録機能を使用
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import { cache } from '../utils/cache.js';
import { CachedChannel } from '../models/CachedChannel.js';

const router = express.Router();

// すべてのルートで認証を必須にする
router.use(authenticate);

/**
 * GET /api/artists
 * 登録中のアーティスト（チャンネル）一覧を取得
 * MongoDBキャッシュから取得（APIクォータ節約のため）
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    // MongoDBキャッシュから全チャンネルを取得
    const cachedChannels = await CachedChannel.find({ userId: req.userId }).lean();

    if (cachedChannels.length > 0) {
      // キャッシュされたチャンネルをYouTube API形式に変換
      const formattedChannels = cachedChannels.map(ch => ({
        id: ch.subscriptionId || ch.channelId,
        snippet: {
          resourceId: {
            channelId: ch.channelId
          },
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

      console.log(`✅ Returning ${formattedChannels.length} artists from MongoDB cache`);
      return res.json(formattedChannels);
    }

    // キャッシュがない場合は空配列を返す（APIクォータ超過時）
    console.log('⚠️  No cached artists found in MongoDB');
    res.json([]);
  } catch (error) {
    console.error('Failed to fetch artists from cache:', error);
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
 * MongoDBキャッシュから最新動画情報を返す（APIクォータ節約）
 */
router.get('/new-releases', async (req: AuthRequest, res: Response) => {
  try {
    // MongoDBキャッシュから全チャンネルを取得し、最新動画IDでソート
    const cachedChannels = await CachedChannel
      .find({
        userId: req.userId,
        latestVideoId: { $exists: true, $ne: null }
      })
      .sort({ latestVideoPublishedAt: -1 })
      .limit(20)
      .lean();

    if (cachedChannels.length > 0) {
      // キャッシュから最新動画情報を構築
      const newReleases = cachedChannels.map(ch => ({
        id: {
          videoId: ch.latestVideoId
        },
        videoId: ch.latestVideoId,
        snippet: {
          channelId: ch.channelId,
          channelTitle: ch.channelTitle,
          title: ch.latestVideoTitle,
          thumbnails: {
            default: { url: ch.latestVideoThumbnail },
            medium: { url: ch.latestVideoThumbnail },
            high: { url: ch.latestVideoThumbnail }
          },
          publishedAt: ch.latestVideoPublishedAt
        },
        title: ch.latestVideoTitle,
        thumbnail: ch.latestVideoThumbnail
      }));

      console.log(`✅ Returning ${newReleases.length} new releases from MongoDB cache`);
      return res.json(newReleases);
    }

    console.log('⚠️  No new releases found in MongoDB cache');
    res.json([]);
  } catch (error) {
    console.error('Failed to fetch new releases from cache:', error);
    res.status(500).json({ error: 'Failed to fetch new releases' });
  }
});

export default router;
