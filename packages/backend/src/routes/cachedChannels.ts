import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { CachedChannel } from '../models/CachedChannel.js';
import mongoose from 'mongoose';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/channels
 * Returns all of a user's subscribed channels (excluding artists) from the cache.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }

    // Exclude channels marked as artists to avoid duplication
    const cachedChannels = await CachedChannel.find({ userId: req.userId, isArtist: { $ne: true } }).sort({ channelTitle: 1 }).lean();
    
    const formatted = cachedChannels.map((ch) => ({
      id: ch.subscriptionId,
      latestVideoId: ch.latestVideoId,
      latestVideoThumbnail: ch.latestVideoThumbnail,
      latestVideoTitle: ch.latestVideoTitle, // Add latest video title for the UI
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
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

export default router;