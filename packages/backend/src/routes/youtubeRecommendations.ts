import express, { Response } from 'express';
import YouTubeChannel from '../models/YouTubeChannel.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes with authentication
router.use(authenticate);

// Get AI-powered channel recommendations
router.get('/channels', async (req: AuthRequest, res: Response) => {
  try {
    const subscribedChannels = await YouTubeChannel.find({ userId: req.userId });

    // Analyze user's interests based on subscribed channels
    const channelNames = subscribedChannels.map(c => c.name);
    const channelDescriptions = subscribedChannels.map(c => c.description || '').filter(Boolean);

    // TODO: Integrate with OpenAI API for better recommendations
    // For now, return mock recommendations based on subscribed channels
    const mockRecommendations = [
      {
        channelId: 'rec_channel_1',
        name: channelNames.length > 0 ? `${channelNames[0]}に似たチャンネル` : 'おすすめチャンネル1',
        thumbnail: 'https://via.placeholder.com/88',
        subscriberCount: '100万',
        description: `${channelNames[0] || 'あなたの好み'}に基づいたおすすめ`,
        reason: `${channelNames[0] || 'あなた'}のファンにおすすめ`
      },
      {
        channelId: 'rec_channel_2',
        name: 'トレンドのチャンネル',
        thumbnail: 'https://via.placeholder.com/88',
        subscriberCount: '50万',
        description: '今注目のコンテンツを配信',
        reason: 'あなたの視聴傾向から選出'
      },
      {
        channelId: 'rec_channel_3',
        name: '新しい発見',
        thumbnail: 'https://via.placeholder.com/88',
        subscriberCount: '30万',
        description: 'あなたが気に入りそうな新しいチャンネル',
        reason: '登録チャンネルの視聴者も観ています'
      }
    ];

    res.json(mockRecommendations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get channel recommendations' });
  }
});

// Get AI-powered video recommendations
router.get('/videos', async (req: AuthRequest, res: Response) => {
  try {
    const subscribedChannels = await YouTubeChannel.find({ userId: req.userId });

    // Get all latest videos from subscribed channels
    const allVideos = subscribedChannels.flatMap(channel =>
      channel.latestVideos.map(video => ({
        ...video.toObject(),
        channelName: channel.name
      }))
    );

    // Mock recommendation logic
    const mockRecommendations = allVideos.slice(0, 10).map(video => ({
      ...video,
      reason: `${video.channelName}の新着動画`
    }));

    res.json(mockRecommendations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get video recommendations' });
  }
});

export default router;
