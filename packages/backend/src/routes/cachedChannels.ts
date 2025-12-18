/**
 * チャンネル一覧（キャッシュ）ルート
 * - アーティスト扱いのチャンネルは除外し、通常チャンネルのみ返します。
 * - DB未接続時は空配列を返します。
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { CachedChannel } from '../models/CachedChannel.js';
import mongoose from 'mongoose';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/channels
 * ユーザーの購読チャンネル（アーティスト除外）をキャッシュから返します。
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }

    // アーティスト扱いのチャンネルは重複防止のため除外
    const cachedChannels = await CachedChannel.find({ userId: req.userId, isArtist: { $ne: true } }).sort({ channelTitle: 1 }).lean();
    
    const formatted = cachedChannels.map((ch) => ({
      id: ch.subscriptionId,
      latestVideoId: ch.latestVideoId,
      latestVideoThumbnail: ch.latestVideoThumbnail,
      latestVideoTitle: ch.latestVideoTitle, // UI表示用に最新動画タイトルも返す
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
      contentDetails: {
        totalItemCount: ch.videoCount,
      }
    }));

    return res.json(formatted);
  } catch (error) {
    console.error('チャンネル取得エラー:', error);
    res.status(500).json({ error: 'チャンネルの取得に失敗しました' });
  }
});

export default router;