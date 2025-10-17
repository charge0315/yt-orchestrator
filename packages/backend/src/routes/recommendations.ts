/**
 * AIおすすめルート
 * OpenAI GPT-3.5を使用してユーザーの登録チャンネルに基づいたおすすめを生成
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import OpenAI from 'openai';

const router = express.Router();

// OpenAI APIキーが設定されている場合のみクライアントを初期化
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// すべてのルートで認証を必須にする
router.use(authenticate);

/**
 * GET /api/recommendations
 * AIによるおすすめチャンネル・アーティストを取得
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const subscriptions = await ytService.getSubscriptions();

    // 登録チャンネルがない場合は空配列を返す
    if (subscriptions.length === 0) {
      return res.json([]);
    }

    // 上位10件のチャンネル名を取得
    const channelNames = subscriptions.slice(0, 10).map((sub: any) => sub.snippet?.title).filter(Boolean);

    // OpenAI APIキーが未設定の場合は、フォールバック処理
    // 登録チャンネルの最新動画を返す
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

    // OpenAI GPT-3.5を使用しておすすめチャンネルを生成
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: `ユーザーは以下のYouTubeチャンネルを登録しています: ${channelNames.join(', ')}。

このユーザーの好みに基づいて、おすすめの音楽アーティストやYouTubeチャンネルを10個提案してください。
各提案には理由も含めてください。

JSON形式で返してください:
[{"name": "アーティスト名またはチャンネル名", "reason": "おすすめの理由（30文字以内）"}]

注意: nameは実在するYouTubeチャンネル名またはアーティスト名にしてください。`
      }],
      temperature: 0.8 // 創造性のレベル（0.0-1.0）
    });

    // AIの応答をパース
    const aiResponse = completion.choices[0]?.message?.content;
    let suggestions = [];
    try {
      suggestions = JSON.parse(aiResponse || '[]');
    } catch {
      // パースに失敗した場合のフォールバック
      suggestions = [{ name: 'おすすめを生成できませんでした', reason: 'もう一度お試しください' }];
    }

    // 各おすすめに対して実際のYouTube動画を検索
    const recommendations = await Promise.all(
      suggestions.slice(0, 10).map(async (sug: any) => {
        try {
          // アーティスト名でYouTubeを検索
          const searchResults = await ytService.searchVideos(sug.name, 1);
          if (searchResults.length > 0) {
            const video = searchResults[0];
            return {
              videoId: video.id?.videoId,
              title: video.snippet?.title,
              channelTitle: video.snippet?.channelTitle || sug.name,
              thumbnail: video.snippet?.thumbnails?.high?.url ||
                         video.snippet?.thumbnails?.medium?.url ||
                         video.snippet?.thumbnails?.default?.url,
              reason: sug.reason
            };
          }
        } catch (error) {
          console.error(`Failed to search for ${sug.name}:`, error);
        }

        // 検索に失敗した場合はプレースホルダー
        return {
          videoId: `ai-rec-${sug.name}`,
          title: sug.name,
          channelTitle: sug.name,
          thumbnail: '',
          reason: sug.reason
        };
      })
    );

    res.json(recommendations);
  } catch (error) {
    console.error('Failed to get recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});



export default router;
