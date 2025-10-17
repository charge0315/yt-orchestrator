import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    const subscriptions = await ytService.getSubscriptions();
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { channelId } = req.body;
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    const subscription = await ytService.subscribe(channelId);
    res.status(201).json(subscription);
  } catch (error) {
    res.status(500).json({ error: 'Failed to subscribe to channel' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    await ytService.unsubscribe(req.params.id);
    res.json({ message: 'Unsubscribed from channel successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe from channel' });
  }
});

export default router;
