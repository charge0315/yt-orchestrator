import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { CachedPlaylist } from '../models/CachedPlaylist.js';
import mongoose from 'mongoose';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/playlists
 * Returns all of a user's non-music playlists from the cache.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ items: [], nextPageToken: undefined });
    }

    // Find playlists that are not marked as music playlists
    const cachedPlaylists = await CachedPlaylist.find({ userId: req.userId, isMusicPlaylist: { $ne: true } }).sort({ cachedAt: -1 }).lean();
    
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