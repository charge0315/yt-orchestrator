/**
 * チャンネル管理ルート
 * YouTube Data API v3のチャンネル登録機能を使用
 * MongoDB優先でキャッシュを活用
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import { cache } from '../utils/cache.js';
import { CachedChannel } from '../models/CachedChannel.js';
import mongoose from 'mongoose';

const router = express.Router();

// すべてのルートで認証を必須にする
router.use(authenticate);

/**
 * DELETE /api/channels/cache
 * MongoDBキャッシュをクリア（開発用）
 */
router.delete('/cache', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const result = await CachedChannel.deleteMany({ userId: req.userId });
      console.log(`🗑️  Cleared ${result.deletedCount} channels from cache for user ${req.userId}`);
      res.json({ message: `Cleared ${result.deletedCount} channels from cache` });
    } else {
      res.status(503).json({ error: 'MongoDB not connected' });
    }
  } catch (error) {
    console.error('Error clearing channel cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * GET /api/channels
 * 登録中のチャンネル一覧を取得
 * MongoDB優先、APIをフォールバックとして使用
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const CACHE_DURATION_MS = 30 * 60 * 1000; // 30分
    let shouldRefreshFromAPI = false;
    let cachedChannels: any[] = [];

    // 1. MongoDBからキャッシュを取得
    if (mongoose.connection.readyState === 1) {
      cachedChannels = await CachedChannel.find({ userId: req.userId });

      if (cachedChannels.length > 0) {
        // キャッシュの有効期限をチェック
        const oldestCache = cachedChannels.reduce((oldest, current) =>
          current.cachedAt < oldest.cachedAt ? current : oldest
        );
        const cacheAge = Date.now() - oldestCache.cachedAt.getTime();

        if (cacheAge < CACHE_DURATION_MS) {
          console.log(`✅ Returning ${cachedChannels.length} channels from MongoDB cache (${Math.round(cacheAge / 1000 / 60)}min old)`);

          // YouTube API形式に変換して返す
          const formattedChannels = cachedChannels.map(ch => ({
            kind: 'youtube#subscription',
            id: ch.subscriptionId,
            snippet: {
              resourceId: { channelId: ch.channelId },
              title: ch.channelTitle,
              description: ch.channelDescription,
              thumbnails: {
                default: { url: ch.thumbnailUrl },
                medium: { url: ch.thumbnailUrl },
                high: { url: ch.thumbnailUrl }
              }
            },
            latestVideoId: ch.latestVideoId,
            latestVideoThumbnail: ch.latestVideoThumbnail,
            latestVideoTitle: ch.latestVideoTitle
          }));

          return res.json(formattedChannels);
        } else {
          console.log('⚠️  MongoDB cache is stale, fetching from YouTube API');
          shouldRefreshFromAPI = true;
        }
      } else {
        console.log('⚠️  No channels found in MongoDB cache, fetching from YouTube API');
        shouldRefreshFromAPI = true;
      }
    } else {
      console.log('⚠️  MongoDB not connected, using YouTube API directly');
      shouldRefreshFromAPI = true;
    }

    // 2. YouTube APIから差分取得
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);

    // キャッシュがある場合は差分更新、ない場合は全取得
    let enrichedSubscriptions: any[] = [];

    if (mongoose.connection.readyState === 1 && cachedChannels && cachedChannels.length > 0) {
      // 差分更新モード：キャッシュされたチャンネルの新しい動画のみチェック
      console.log('🔄 Using incremental update mode for channels');

      enrichedSubscriptions = await Promise.all(
        cachedChannels.map(async (cached) => {
          try {
            const channelId = cached.channelId;
            const lastPublishedAt = cached.latestVideoPublishedAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // デフォルト7日前

            // 差分取得：最終チェック日時以降の動画のみ
            const newVideos = await ytService.getChannelVideosIncremental(channelId, lastPublishedAt, 5);

            if (newVideos.length > 0) {
              const latestVideo = newVideos[0];
              return {
                kind: 'youtube#subscription',
                id: cached.subscriptionId,
                snippet: {
                  resourceId: { channelId: cached.channelId },
                  title: cached.channelTitle,
                  description: cached.channelDescription,
                  thumbnails: {
                    default: { url: cached.thumbnailUrl },
                    medium: { url: cached.thumbnailUrl },
                    high: { url: cached.thumbnailUrl }
                  }
                },
                latestVideoId: latestVideo.id?.videoId || latestVideo.id,
                latestVideoThumbnail: latestVideo.snippet?.thumbnails?.high?.url ||
                                     latestVideo.snippet?.thumbnails?.medium?.url ||
                                     latestVideo.snippet?.thumbnails?.default?.url,
                latestVideoTitle: latestVideo.snippet?.title,
                latestVideoPublishedAt: latestVideo.snippet?.publishedAt ? new Date(latestVideo.snippet.publishedAt) : undefined
              };
            } else {
              // 新しい動画がない場合はキャッシュをそのまま返す
              return {
                kind: 'youtube#subscription',
                id: cached.subscriptionId,
                snippet: {
                  resourceId: { channelId: cached.channelId },
                  title: cached.channelTitle,
                  description: cached.channelDescription,
                  thumbnails: {
                    default: { url: cached.thumbnailUrl },
                    medium: { url: cached.thumbnailUrl },
                    high: { url: cached.thumbnailUrl }
                  }
                },
                latestVideoId: cached.latestVideoId,
                latestVideoThumbnail: cached.latestVideoThumbnail,
                latestVideoTitle: cached.latestVideoTitle,
                latestVideoPublishedAt: cached.latestVideoPublishedAt
              };
            }
          } catch (error) {
            console.error(`Failed to fetch incremental update for channel ${cached.channelTitle}:`, error);
            // エラー時はキャッシュをそのまま返す
            return {
              kind: 'youtube#subscription',
              id: cached.subscriptionId,
              snippet: {
                resourceId: { channelId: cached.channelId },
                title: cached.channelTitle,
                description: cached.channelDescription,
                thumbnails: {
                  default: { url: cached.thumbnailUrl },
                  medium: { url: cached.thumbnailUrl },
                  high: { url: cached.thumbnailUrl }
                }
              },
              latestVideoId: cached.latestVideoId,
              latestVideoThumbnail: cached.latestVideoThumbnail,
              latestVideoTitle: cached.latestVideoTitle
            };
          }
        })
      );
    } else {
      // 全取得モード：初回または キャッシュなし
      console.log('📥 Using full fetch mode for channels');
      const result = await ytService.getSubscriptions();

      enrichedSubscriptions = await Promise.all(
        result.items.map(async (sub: any) => {
          try {
            const channelId = sub.snippet?.resourceId?.channelId;
            if (channelId) {
              const videos = await ytService.getChannelVideos(channelId, 1);
              if (videos.length > 0) {
                const latestVideo = videos[0];
                return {
                  ...sub,
                  latestVideoId: latestVideo.id?.videoId || latestVideo.id,
                  latestVideoThumbnail: latestVideo.snippet?.thumbnails?.high?.url ||
                                       latestVideo.snippet?.thumbnails?.medium?.url ||
                                       latestVideo.snippet?.thumbnails?.default?.url,
                  latestVideoTitle: latestVideo.snippet?.title,
                  latestVideoPublishedAt: latestVideo.snippet?.publishedAt ? new Date(latestVideo.snippet.publishedAt) : undefined
                };
              }
            }
          } catch (error) {
            console.error(`Failed to fetch latest video for channel ${sub.snippet?.title}:`, error);
          }
          return sub;
        })
      );
    }

    // 3. MongoDBにキャッシュを保存
    if (mongoose.connection.readyState === 1) {
      try {
        const bulkOps = enrichedSubscriptions.map((sub: any) => ({
          updateOne: {
            filter: {
              userId: req.userId,
              channelId: sub.snippet?.resourceId?.channelId
            },
            update: {
              channelTitle: sub.snippet?.title,
              channelDescription: sub.snippet?.description,
              thumbnailUrl: sub.snippet?.thumbnails?.high?.url ||
                           sub.snippet?.thumbnails?.medium?.url ||
                           sub.snippet?.thumbnails?.default?.url,
              latestVideoId: sub.latestVideoId,
              latestVideoThumbnail: sub.latestVideoThumbnail,
              latestVideoTitle: sub.latestVideoTitle,
              latestVideoPublishedAt: sub.latestVideoPublishedAt, // 差分更新用の日時を保存
              subscriptionId: sub.id,
              cachedAt: new Date()
            },
            upsert: true
          }
        }));

        await CachedChannel.bulkWrite(bulkOps);
        console.log(`✅ Saved ${enrichedSubscriptions.length} channels to MongoDB cache (with incremental update metadata)`);
      } catch (dbError) {
        console.error('Failed to save channels to MongoDB:', dbError);
      }
    }

    res.json(enrichedSubscriptions);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

/**
 * POST /api/channels
 * チャンネルを登録
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { channelId } = req.body;
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const subscription = await ytService.subscribe(channelId);

    // MongoDBのキャッシュをクリア（次回取得時に再キャッシュ）
    if (mongoose.connection.readyState === 1) {
      try {
        await CachedChannel.deleteMany({ userId: req.userId });
        console.log('✅ Cleared MongoDB channel cache after subscription');
      } catch (dbError) {
        console.error('Failed to clear channel cache:', dbError);
      }
    }

    res.status(201).json(subscription);
  } catch (error) {
    console.error('Error subscribing to channel:', error);
    res.status(500).json({ error: 'Failed to subscribe to channel' });
  }
});

/**
 * DELETE /api/channels/:id
 * チャンネルの登録を解除
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    await ytService.unsubscribe(req.params.id);

    // MongoDBから該当チャンネルを削除
    if (mongoose.connection.readyState === 1) {
      try {
        await CachedChannel.deleteOne({
          userId: req.userId,
          subscriptionId: req.params.id
        });
        console.log('✅ Removed channel from MongoDB cache');
      } catch (dbError) {
        console.error('Failed to remove channel from cache:', dbError);
      }
    }

    res.json({ message: 'Unsubscribed from channel successfully' });
  } catch (error) {
    console.error('Error unsubscribing from channel:', error);
    res.status(500).json({ error: 'Failed to unsubscribe from channel' });
  }
});

export default router;
