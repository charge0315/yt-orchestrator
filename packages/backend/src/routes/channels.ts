/**
 * チャンネル ルーター
 * - YouTube Data API v3 の登録チャンネルを扱う（非アーティスト向け）
 * - MongoDB キャッシュ優先、必要時のみ API 取得
 * - 日次制限（1日1回）に対応
 */
import express, { Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { CachedChannel } from '../models/CachedChannel.js'
import mongoose from 'mongoose'

const router = express.Router()

// すべてのルートで認証を必須にする
router.use(authenticate)

/**
 * DELETE /api/channels/cache
 * MongoDB キャッシュをクリア（開発用）
 */
router.delete('/cache', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const result = await CachedChannel.deleteMany({ userId: req.userId })
      console.log(`🗑 Cleared ${result.deletedCount} channels from cache for user ${req.userId}`)
      res.json({ message: `Cleared ${result.deletedCount} channels from cache` })
    } else {
      res.status(503).json({ error: 'MongoDB not connected' })
    }
  } catch (error) {
    console.error('Error clearing channel cache:', error)
    res.status(500).json({ error: 'Failed to clear cache' })
  }
})

/**
 * GET /api/channels
 * 登録中のチャンネル一覧を返却（DBに存在するものはすべて返す）
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }

    const cachedChannels = await CachedChannel.find({ userId: req.userId }).sort({ cachedAt: -1 });
    const formatted = cachedChannels.map((ch) => ({
      kind: 'youtube#subscription',
      id: ch.subscriptionId,
      snippet: {
        resourceId: { channelId: ch.channelId },
        title: ch.channelTitle,
        description: ch.channelDescription,
        thumbnails: {
          default: { url: ch.thumbnailUrl },
          medium: { url: ch.thumbnailUrl },
          high: { url: ch.thumbnailUrl },
        },
      },
      latestVideoId: ch.latestVideoId,
      latestVideoThumbnail: ch.latestVideoThumbnail,
      latestVideoTitle: ch.latestVideoTitle,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error('Error fetching channels (Mongo only):', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

export default router
