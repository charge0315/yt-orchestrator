import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import OpenAI from 'openai';

const router = express.Router();
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    const subscriptions = await ytService.getSubscriptions();
    
    if (subscriptions.length === 0) {
      return res.json([]);
    }

    const channelNames = subscriptions.slice(0, 10).map((sub: any) => sub.snippet?.title).filter(Boolean);
    
    if (!openai) {
      const recommendations = [];
      for (let i = 0; i < Math.min(3, subscriptions.length); i++) {
        const sub = subscriptions[i];
        const channelId = sub.snippet?.resourceId?.channelId;
        if (channelId) {
          const videos = await ytService.getChannelVideos(channelId, 1);
          if (videos.length > 0) {
            recommendations.push({
              videoId: videos[0].id?.videoId,
              title: videos[0].snippet?.title,
              channelTitle: videos[0].snippet?.channelTitle,
              thumbnail: videos[0].snippet?.thumbnails?.default?.url,
              reason: `${sub.snippet?.title}の最新動画`
            });
          }
        }
      }
      return res.json(recommendations);
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: `ユーザーは以下のYouTubeチャンネルを登録しています: ${channelNames.join(', ')}。このユーザーにおすすめの音楽アーティストやYouTubeチャンネルを3つ提案してください。各提案には理由も含めてください。JSON形式で返してください: [{"name": "チャンネル名", "reason": "理由"}]`
      }],
      temperature: 0.7
    });

    const aiResponse = completion.choices[0]?.message?.content;
    let suggestions = [];
    try {
      suggestions = JSON.parse(aiResponse || '[]');
    } catch {
      suggestions = [{ name: 'おすすめを生成できませんでした', reason: 'もう一度お試しください' }];
    }

    const recommendations = suggestions.map((sug: any, idx: number) => ({
      videoId: `ai-rec-${idx}`,
      title: sug.name,
      channelTitle: sug.name,
      thumbnail: '',
      reason: sug.reason
    }));

    res.json(recommendations);
  } catch (error) {
    console.error('Failed to get recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});



export default router;
