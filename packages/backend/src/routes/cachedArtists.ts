/**
 * アーティスト一覧（キャッシュ）ルート
 * - `isArtist=true` のチャンネルをアーティストとして扱い返します。
 * - `/new-releases` は最新動画（キャッシュ）を返します。
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { CachedChannel } from '../models/CachedChannel.js';
import mongoose from 'mongoose';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/artists
 * アーティスト扱いのチャンネルをキャッシュから返します。
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) { return res.json([]); }

    const cachedArtists = await CachedChannel.find({ userId: req.userId, isArtist: true }).sort({ channelTitle: 1 }).lean();
    
    const formatted = cachedArtists.map((ch) => ({
      id: ch.subscriptionId, // UI側のチャンネル形式に合わせる
      latestVideoId: ch.latestVideoId,
      latestVideoThumbnail: ch.latestVideoThumbnail,
      latestVideoTitle: ch.latestVideoTitle,
      snippet: {
        resourceId: { channelId: ch.channelId },
        title: ch.channelTitle,
        thumbnails: { default: { url: ch.thumbnailUrl } },
      },
    }));

    return res.json(formatted);
  } catch (error) {
    console.error('アーティスト取得エラー:', error);
    res.status(500).json({ error: 'アーティストの取得に失敗しました' });
  }
});

/**
 * GET /api/artists/new-releases
 * 購読チャンネル全体の最新動画を（キャッシュから）返します。
 */
router.get('/new-releases', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) { return res.json([]); }

    const channels = await CachedChannel.find({
      userId: req.userId,
      latestVideoId: { $exists: true, $ne: null },
      latestVideoPublishedAt: { $exists: true, $ne: null }
    }).sort({ latestVideoPublishedAt: -1 }).limit(20).lean();

    const formatted = channels.map((ch) => ({
      id: { videoId: ch.latestVideoId },
      videoId: ch.latestVideoId,
      snippet: {
          title: ch.latestVideoTitle,
          thumbnails: { medium: { url: ch.latestVideoThumbnail } },
          channelTitle: ch.channelTitle,
          channelId: ch.channelId,
          publishedAt: ch.latestVideoPublishedAt,
      }
    }));

    res.json(formatted);
  } catch (error) {
    console.error('新着動画取得エラー:', error);
    res.status(500).json({ error: '新着動画の取得に失敗しました' });
  }
});

export default router;