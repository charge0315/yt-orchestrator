import express, { Response } from 'express';
import YouTubeChannel from '../models/YouTubeChannel.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes with authentication
router.use(authenticate);

// Get all subscribed YouTube channels for the authenticated user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const channels = await YouTubeChannel.find({ userId: req.userId }).sort({ subscribedAt: -1 });
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch YouTube channels' });
  }
});

// Subscribe to a YouTube channel
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, channelId, thumbnail, description, subscriberCount } = req.body;

    const existingChannel = await YouTubeChannel.findOne({
      userId: req.userId,
      channelId
    });

    if (existingChannel) {
      return res.status(400).json({ error: 'Already subscribed to this channel' });
    }

    const channel = new YouTubeChannel({
      name,
      channelId,
      thumbnail,
      description,
      subscriberCount,
      latestVideos: [],
      userId: req.userId
    });

    await channel.save();
    res.status(201).json(channel);
  } catch (error) {
    res.status(500).json({ error: 'Failed to subscribe to YouTube channel' });
  }
});

// Unsubscribe from a YouTube channel
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const channel = await YouTubeChannel.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    if (!channel) {
      return res.status(404).json({ error: 'YouTube channel not found' });
    }
    res.json({ message: 'Unsubscribed from YouTube channel successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe from YouTube channel' });
  }
});

// Get latest videos from all subscribed channels
router.get('/latest-videos', async (req: AuthRequest, res: Response) => {
  try {
    const channels = await YouTubeChannel.find({ userId: req.userId });
    const allLatestVideos = channels.flatMap(channel =>
      channel.latestVideos.map(video => ({
        ...video.toObject(),
        channelName: channel.name,
        channelId: channel.channelId,
        channelThumbnail: channel.thumbnail
      }))
    );

    // Sort by published date, newest first
    allLatestVideos.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    res.json(allLatestVideos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch latest videos' });
  }
});

// Update latest videos for a specific channel (can be called periodically)
router.post('/:id/update-videos', async (req: AuthRequest, res: Response) => {
  try {
    const { latestVideos } = req.body;

    const channel = await YouTubeChannel.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!channel) {
      return res.status(404).json({ error: 'YouTube channel not found' });
    }

    channel.latestVideos = latestVideos;
    channel.lastChecked = new Date();
    await channel.save();

    res.json(channel);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update channel videos' });
  }
});

export default router;
