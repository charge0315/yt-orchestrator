/**
 * アーティスト一覧（キャッシュ）ルート
 * - `isArtist=true` のチャンネルをアーティストとして扱い返します。
 * - `/new-releases` は最新動画（キャッシュ）を返します。
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { CachedChannel } from '../models/CachedChannel.js';
import mongoose from 'mongoose';
import { acquireYouTubeDaily } from '../utils/dailyGate.js';
import { updateUserCaches } from '../jobs/updateCache.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/artists
 * アーティスト扱いのチャンネルをキャッシュから返します。
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) { return res.json([]); }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const force = String((req.query as any)?.force || '') === '1' || String((req.query as any)?.refresh || '') === '1' || String((req.query as any)?.force || '') === 'true' || String((req.query as any)?.refresh || '') === 'true';

    let cachedArtists = await CachedChannel.find({ userId, isArtist: true }).sort({ channelTitle: 1 }).lean();

    // 空の場合は、必要に応じて isArtist 判定を含むキャッシュ更新を試行する
    if (cachedArtists.length === 0) {
      const canUseToday = await acquireYouTubeDaily(userId);
      if (!canUseToday && force) {
        return res.status(429).json({ error: 'daily_limit', message: '本日は既に強制更新を実行済みです。時間をおいて再試行してください。' });
      }

      if (canUseToday) {
        try {
          console.log(`🔄 アーティスト判定のキャッシュ更新を試行します（user=${userId} / force=${force} / daily=${canUseToday}）`);
          await updateUserCaches(userId, true);
        } catch (e) {
          console.warn('アーティスト判定のキャッシュ更新に失敗しました:', e);
        }
        cachedArtists = await CachedChannel.find({ userId, isArtist: true }).sort({ channelTitle: 1 }).lean();
      }
    }
    
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
 * POST /api/artists
 * 指定したチャンネルを「アーティスト扱い」に変更します（購読操作ではなく分類フラグ）。
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) { return res.status(503).json({ error: 'mongodb_not_connected' }); }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const channelId = req.body?.channelId;
    if (!channelId || typeof channelId !== 'string') {
      return res.status(400).json({ error: 'channelId_required' });
    }

    const updated = await CachedChannel.findOneAndUpdate(
      { userId, channelId },
      { $set: { isArtist: true, cachedAt: new Date() } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: 'not_found', message: '対象チャンネルがキャッシュに存在しません。先にキャッシュ更新を実行してください。' });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('アーティスト登録エラー:', error);
    return res.status(500).json({ error: 'subscribe_failed' });
  }
});

/**
 * DELETE /api/artists/:id
 * アーティスト扱いを解除します（id は subscriptionId または channelId を許容）。
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) { return res.status(503).json({ error: 'mongodb_not_connected' }); }
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'id_required' });

    const updated = await CachedChannel.findOneAndUpdate(
      { userId, $or: [{ subscriptionId: id }, { channelId: id }] },
      { $set: { isArtist: false, cachedAt: new Date() } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: 'not_found' });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('アーティスト解除エラー:', error);
    return res.status(500).json({ error: 'unsubscribe_failed' });
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