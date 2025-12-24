/**
 * キャッシュ操作ルート
 * - MongoDBキャッシュをクリアして強制再同期します
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { refreshUserCache } from '../jobs/updateCache.js';

const router = express.Router();

router.use(authenticate);

/**
 * POST /api/cache/refresh
 * 現在ログイン中のユーザーのキャッシュをクリアし、最新状態に再同期します。
 */
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'ユーザーが認証されていません' });

    const result = await refreshUserCache(userId);
    if (!result.ok) {
      const status = result.error === 'mongodb_not_connected' ? 503 : 400;
      return res.status(status).json(result);
    }

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
