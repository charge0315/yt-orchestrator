import express, { Request, Response } from 'express';
import Channel from '../models/Channel.js';

const router = express.Router();

// Get all subscribed channels
router.get('/', async (req: Request, res: Response) => {
  try {
    const channels = await Channel.find().sort({ subscribedAt: -1 });
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Subscribe to a channel
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, channelId, thumbnail, description } = req.body;

    const existingChannel = await Channel.findOne({ channelId });
    if (existingChannel) {
      return res.status(400).json({ error: 'Already subscribed to this channel' });
    }

    const channel = new Channel({
      name,
      channelId,
      thumbnail,
      description
    });

    await channel.save();
    res.status(201).json(channel);
  } catch (error) {
    res.status(500).json({ error: 'Failed to subscribe to channel' });
  }
});

// Unsubscribe from a channel
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const channel = await Channel.findByIdAndDelete(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json({ message: 'Unsubscribed from channel successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe from channel' });
  }
});

export default router;
