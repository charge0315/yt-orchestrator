/**
 * AIおすすめルート
 * OpenAI GPT-3.5を使用してユーザーの登録チャンネルに基づいたおすすめを生成
 * キャッシュを積極的に活用してYouTube APIクォータを節約
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import { CachedChannel } from '../models/CachedChannel.js';
import OpenAI from 'openai';

const router = express.Router();

// OpenAI APIキーが設定されている場合のみクライアントを初期化
const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'DUMMY_OPENAI_API_KEY'
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// すべてのルートで認証を必須にする
router.use(authenticate);

/**
 * GET /api/recommendations
 * AIによるおすすめチャンネル・アーティストを取得
 * MongoDBキャッシュを使用してYouTube APIクォータを節約
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // MongoDBキャッシュから登録チャンネル情報を取得（YouTube API不使用）
    const cachedChannels = await CachedChannel.find({ userId })
      .sort({ cachedAt: -1 })
      .limit(20)
      .lean();

    console.log(`Found ${cachedChannels.length} cached channels for user ${userId}`);

    // 事前定義されたおすすめチャンネルリスト（YouTube APIクォータゼロで動作）
    // 人気の音楽系チャンネルから選定
    const predefinedRecommendations = [
      {
        channelId: 'UC-9-kyTW8ZkZNDHQJ6FgpwQ',
        name: 'Music',
        videoId: 'dQw4w9WgXcQ', // サンプル動画ID
        title: 'トレンドの音楽',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        reason: '最新のヒット曲をチェック'
      },
      {
        channelId: 'UCSJ4gkVC6NrvII8umztf0Ow',
        name: 'Lofi Girl',
        videoId: 'jfKfPfyJRdk',
        title: 'Lofi Hip Hop Radio',
        thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
        reason: 'リラックスできる音楽'
      },
      {
        channelId: 'UCfM3zsQsOnfWNUppiycmBuw',
        name: 'Music Lab',
        videoId: 'wXhTHyIgQ_U',
        title: '音楽理論を学ぼう',
        thumbnail: 'https://i.ytimg.com/vi/wXhTHyIgQ_U/hqdefault.jpg',
        reason: '音楽の知識を深める'
      },
      {
        channelId: 'UCq19-LqvG35A-30oyAiPiqA',
        name: 'COLORS',
        videoId: 'faG8RiaJ3-k',
        title: 'COLORS SHOW',
        thumbnail: 'https://i.ytimg.com/vi/faG8RiaJ3-k/hqdefault.jpg',
        reason: '新進気鋭のアーティスト発掘'
      },
      {
        channelId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
        name: 'PewDiePie',
        videoId: 'n6NLuruR9uI',
        title: 'エンターテイメント',
        thumbnail: 'https://i.ytimg.com/vi/n6NLuruR9uI/hqdefault.jpg',
        reason: 'トップYouTuberのコンテンツ'
      },
      {
        channelId: 'UCJFp8uSYCjXOMnkUyb3CQ3Q',
        name: 'Tasty',
        videoId: 'VHbpdKiInn8',
        title: '簡単レシピ',
        thumbnail: 'https://i.ytimg.com/vi/VHbpdKiInn8/hqdefault.jpg',
        reason: '料理を楽しむ'
      },
      {
        channelId: 'UCBJycsmduvYEL83R_U4JriQ',
        name: 'MKBHD',
        videoId: 'DkHTHbN1nfs',
        title: 'テクノロジーレビュー',
        thumbnail: 'https://i.ytimg.com/vi/DkHTHbN1nfs/hqdefault.jpg',
        reason: '最新ガジェット情報'
      },
      {
        channelId: 'UCX6OQ3DkcsbYNE6H8uQQuVA',
        name: 'MrBeast',
        videoId: 'gD4JNmbI4fQ',
        title: '驚きの企画動画',
        thumbnail: 'https://i.ytimg.com/vi/gD4JNmbI4fQ/hqdefault.jpg',
        reason: '大規模チャレンジ企画'
      },
      {
        channelId: 'UCYfdidRxbB8Qhf0Nx7ioOYw',
        name: 'Veritasium',
        videoId: 'J3xLuZNKhlY',
        title: '科学の不思議',
        thumbnail: 'https://i.ytimg.com/vi/J3xLuZNKhlY/hqdefault.jpg',
        reason: '科学と教育コンテンツ'
      },
      {
        channelId: 'UC4QobU6STFB0P71PMvOGN5A',
        name: 'Vsauce',
        videoId: 'TN25ghkfgQA',
        title: '不思議な科学',
        thumbnail: 'https://i.ytimg.com/vi/TN25ghkfgQA/hqdefault.jpg',
        reason: '好奇心を刺激する内容'
      }
    ];

    // 登録済みチャンネルIDのセットを作成
    const subscribedChannelIds = new Set(
      cachedChannels.map((ch) => ch.channelId)
    );

    // 未登録のチャンネルのみをフィルタリング
    const recommendations = predefinedRecommendations
      .filter((rec) => !subscribedChannelIds.has(rec.channelId))
      .slice(0, 5)
      .map((rec) => ({
        channelId: rec.channelId,
        videoId: rec.videoId,
        title: rec.title,
        channelTitle: rec.name,
        thumbnail: rec.thumbnail,
        reason: rec.reason
      }));

    console.log(`Returning ${recommendations.length} recommendations (quota-free)`);
    res.json(recommendations);
  } catch (error) {
    console.error('Failed to get recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});



export default router;
