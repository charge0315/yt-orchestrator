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
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { channelId } = req.body;
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    const subscription = await ytService.subscribe(channelId);
    res.status(201).json(subscription);
  } catch (error) {
    res.status(500).json({ error: 'Failed to subscribe to artist' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    await ytService.unsubscribe(req.params.id);
    res.json({ message: 'Unsubscribed from artist successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe from artist' });
  }
});

router.get('/new-releases', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    const subscriptions = await ytService.getSubscriptions();
    const allNewReleases = [];
    
    for (const sub of subscriptions) {
      const channelId = sub.snippet?.resourceId?.channelId;
      if (channelId) {
        const videos = await ytService.getChannelVideos(channelId, 5);
        allNewReleases.push(...videos);
      }
    }
    
    res.json(allNewReleases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch new releases' });
  }
});

export default router;
