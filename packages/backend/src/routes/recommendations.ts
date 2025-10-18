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
    const subscriptionsResult = await ytService.getSubscriptions();
    const subscriptions = subscriptionsResult.items || [];

    // 登録チャンネルがない場合は空配列を返す
    if (subscriptions.length === 0) {
      return res.json([]);
    }

    // 上位10件のチャンネル名を取得
    const channelNames = subscriptions.slice(0, 10).map((sub: any) => sub.snippet?.title).filter(Boolean);

    // OpenAI APIキーが未設定の場合は、フォールバック処理
    // 人気の音楽カテゴリから動画を検索（登録チャンネル以外）
    if (!openai) {
      const recommendations = [];
      const subscribedChannelIds = new Set(
        subscriptions.map((sub: any) => sub.snippet?.resourceId?.channelId).filter(Boolean)
      );

      // 人気の音楽ジャンルキーワード
      const musicGenres = ['jpop', 'jazz', 'rock', 'classical music', 'indie music', 'kpop', 'edm', 'acoustic'];

      for (const genre of musicGenres.slice(0, 5)) {
        try {
          const searchResults = await ytService.searchVideos(genre + ' music', 2);
          for (const video of searchResults) {
            const channelId = video.snippet?.channelId;
            // 登録チャンネル以外からピックアップ
            if (channelId && !subscribedChannelIds.has(channelId)) {
              recommendations.push({
                videoId: video.id?.videoId,
                title: video.snippet?.title,
                channelTitle: video.snippet?.channelTitle,
                thumbnail: video.snippet?.thumbnails?.high?.url ||
                           video.snippet?.thumbnails?.medium?.url ||
                           video.snippet?.thumbnails?.default?.url,
                reason: `${genre}のおすすめ`
              });
              break; // 各ジャンル1つまで
            }
          }
          if (recommendations.length >= 5) break;
        } catch (error) {
          console.error(`Failed to search for ${genre}:`, error);
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

このユーザーの好みに基づいて、まだ登録していないおすすめの音楽アーティストやYouTubeチャンネルを10個提案してください。
各提案には理由も含めてください。

重要: 既に登録しているチャンネル（${channelNames.join(', ')}）は除外してください。

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

    // 登録チャンネルIDのセットを作成（除外用）
    const subscribedChannelIds = new Set(
      subscriptions.map((sub: any) => sub.snippet?.resourceId?.channelId).filter(Boolean)
    );

    // 各おすすめに対して実際のYouTube動画を検索（登録チャンネル以外）
    const recommendations = await Promise.all(
      suggestions.slice(0, 10).map(async (sug: any) => {
        try {
          // アーティスト名でYouTubeを検索（複数結果を取得してフィルタリング）
          const searchResults = await ytService.searchVideos(sug.name, 5);

          // 登録チャンネル以外の動画を探す
          const nonSubscribedVideo = searchResults.find((video: any) => {
            const channelId = video.snippet?.channelId;
            return channelId && !subscribedChannelIds.has(channelId);
          });

          if (nonSubscribedVideo) {
            return {
              videoId: nonSubscribedVideo.id?.videoId,
              title: nonSubscribedVideo.snippet?.title,
              channelTitle: nonSubscribedVideo.snippet?.channelTitle || sug.name,
              thumbnail: nonSubscribedVideo.snippet?.thumbnails?.high?.url ||
                         nonSubscribedVideo.snippet?.thumbnails?.medium?.url ||
                         nonSubscribedVideo.snippet?.thumbnails?.default?.url,
              reason: sug.reason
            };
          }
        } catch (error) {
          console.error(`Failed to search for ${sug.name}:`, error);
        }

        // 検索に失敗した場合や登録チャンネルのみの場合はnullを返す
        return null;
      })
    );

    // nullを除外
    const filteredRecommendations = recommendations.filter((rec): rec is NonNullable<typeof rec> => rec !== null);

    res.json(filteredRecommendations);
  } catch (error) {
    console.error('Failed to get recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});



export default router;
