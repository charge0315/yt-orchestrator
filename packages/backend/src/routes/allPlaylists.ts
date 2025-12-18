/**
 * プレイリスト一覧（キャッシュ）ルート
 * - DBキャッシュからプレイリストを返します。
 * - 返却形式はフロント側が期待する YouTube API 風の形に整形します。
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { CachedPlaylist } from '../models/CachedPlaylist.js';
import mongoose from 'mongoose';

const router = express.Router();

// 全エンドポイントで認証が必要
router.use(authenticate);

/**
 * GET /api/playlists
 * ユーザーのプレイリストをキャッシュから返します。
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ items: [], nextPageToken: undefined });
    }

    const cachedPlaylists = await CachedPlaylist.find({ userId: req.userId }).sort({ cachedAt: -1 }).lean();
    
    const formatted = cachedPlaylists.map((pl) => ({
      kind: 'youtube#playlist',
      id: pl.playlistId,
      snippet: {
        title: pl.title,
        description: pl.description,
        thumbnails: {
          default: { url: pl.thumbnailUrl },
          medium: { url: pl.thumbnailUrl },
          high: { url: pl.thumbnailUrl },
        },
        channelId: pl.channelId,
        channelTitle: pl.channelTitle,
      },
      contentDetails: { itemCount: pl.itemCount },
      status: { privacyStatus: pl.privacy },
      isMusicPlaylist: pl.isMusicPlaylist === true,
    }));

    return res.json({ items: formatted, nextPageToken: undefined });
  } catch (error) {
    console.error('Error fetching non-music playlists:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

export default router;