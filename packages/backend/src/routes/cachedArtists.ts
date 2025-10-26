import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { CachedChannel } from '../models/CachedChannel.js';
import mongoose from 'mongoose';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/artists
 * Returns all artist channels from the cache.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) { return res.json([]); }

    const cachedArtists = await CachedChannel.find({ userId: req.userId, isArtist: true }).sort({ channelTitle: 1 }).lean();
    
    const formatted = cachedArtists.map((ch) => ({
      id: ch.subscriptionId, // Match channel format for UI consistency
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
    console.error('Error fetching artists:', error);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

/**
 * GET /api/artists/new-releases
 * Returns the latest videos from all subscribed channels.
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
    console.error('Error fetching new releases:', error);
    res.status(500).json({ error: 'Failed to fetch new releases' });
  }
});

export default router;