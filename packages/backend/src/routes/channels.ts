/**
 * 繝√Ε繝ｳ繝阪Ν邂｡逅・Ν繝ｼ繝・
 * YouTube Data API v3縺ｮ繝√Ε繝ｳ繝阪Ν逋ｻ骭ｲ讖溯・繧剃ｽｿ逕ｨ
 * MongoDB蜆ｪ蜈医〒繧ｭ繝｣繝・す繝･繧呈ｴｻ逕ｨ
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import { cache } from '../utils/cache.js';
import { CachedChannel } from '../models/CachedChannel.js';
import mongoose from 'mongoose';

const router = express.Router();

// 縺吶∋縺ｦ縺ｮ繝ｫ繝ｼ繝医〒隱崎ｨｼ繧貞ｿ・医↓縺吶ｋ
router.use(authenticate);

/**
 * DELETE /api/channels/cache
 * MongoDB繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢・磯幕逋ｺ逕ｨ・・
 */
router.delete('/cache', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const result = await CachedChannel.deleteMany({ userId: req.userId });
      console.log(`卵・・ Cleared ${result.deletedCount} channels from cache for user ${req.userId}`);
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
 * 逋ｻ骭ｲ荳ｭ縺ｮ繝√Ε繝ｳ繝阪Ν荳隕ｧ繧貞叙蠕・
 * MongoDB蜆ｪ蜈医、PI繧偵ヵ繧ｩ繝ｼ繝ｫ繝舌ャ繧ｯ縺ｨ縺励※菴ｿ逕ｨ
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24時間
    let shouldRefreshFromAPI = false;
    let cachedChannels: any[] = [];

    // 1. MongoDB縺九ｉ繧ｭ繝｣繝・す繝･繧貞叙蠕・
    if (mongoose.connection.readyState === 1) {
      // 繧｢繝ｼ繝・ぅ繧ｹ繝井ｻ･螟厄ｼ磯壼ｸｸ繝√Ε繝ｳ繝阪Ν・峨・縺ｿ
      cachedChannels = await CachedChannel.find({ userId: req.userId, isArtist: false });

      if (cachedChannels.length > 0) {
        // 繧ｭ繝｣繝・す繝･縺ｮ譛牙柑譛滄剞繧偵メ繧ｧ繝・け
        const oldestCache = cachedChannels.reduce((oldest, current) =>
          current.cachedAt < oldest.cachedAt ? current : oldest
        );
        const cacheAge = Date.now() - oldestCache.cachedAt.getTime();

        if (cacheAge < CACHE_DURATION_MS) {
          console.log(`笨・Returning ${cachedChannels.length} channels from MongoDB cache (${Math.round(cacheAge / 1000 / 60)}min old)`);

          // 譛譁ｰ蜍慕判諠・ｱ縺梧ｬ關ｽ縺励※縺・ｋ繧ｨ繝ｳ繝医Μ縺ｮ縺ｿ霆ｽ驥上↓陬懷ｮ・          let ytForEnrich: YouTubeApiService | undefined;
          const enriched = await Promise.all(
            cachedChannels.map(async (ch) => {
              if (ch.latestVideoId && ch.latestVideoTitle && ch.latestVideoThumbnail) {
                return ch;
              }
              try {
                if (!ytForEnrich) {
                  ytForEnrich = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
                }
                const vids = await ytForEnrich.getChannelVideos(ch.channelId, 1);
                const latest = vids?.[0];
                if (latest) {
                  ch.latestVideoId = latest.id?.videoId || (latest as any).id;
                  ch.latestVideoTitle = latest.snippet?.title;
                  ch.latestVideoThumbnail = latest.snippet?.thumbnails?.high?.url || latest.snippet?.thumbnails?.medium?.url || latest.snippet?.thumbnails?.default?.url;
                  ch.latestVideoPublishedAt = latest.snippet?.publishedAt ? new Date(latest.snippet.publishedAt) : ch.latestVideoPublishedAt;
                  ch.cachedAt = new Date();
                  try { await ch.save(); } catch {}
                }
              } catch {}
              return ch;
            })
          );

          // YouTube API蠖｢蠑上↓螟画鋤縺励※霑斐☆
          const formattedChannels = enriched.map(ch => ({
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
          console.log('笞・・ MongoDB cache is stale, fetching from YouTube API');
          shouldRefreshFromAPI = true;
        }
      } else {
        console.log('笞・・ No channels found in MongoDB cache, fetching from YouTube API');
        shouldRefreshFromAPI = true;
      }
    } else {
      console.log('笞・・ MongoDB not connected, using YouTube API directly');
      shouldRefreshFromAPI = true;
    }

    // 2. YouTube API縺九ｉ蟾ｮ蛻・叙蠕・
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);

    // 繧ｭ繝｣繝・す繝･縺後≠繧句ｴ蜷医・蟾ｮ蛻・峩譁ｰ縲√↑縺・ｴ蜷医・蜈ｨ蜿門ｾ・
    let enrichedSubscriptions: any[] = [];

    if (mongoose.connection.readyState === 1 && cachedChannels && cachedChannels.length > 0) {
      // 蟾ｮ蛻・峩譁ｰ繝｢繝ｼ繝会ｼ壹く繝｣繝・す繝･縺輔ｌ縺溘メ繝｣繝ｳ繝阪Ν縺ｮ譁ｰ縺励＞蜍慕判縺ｮ縺ｿ繝√ぉ繝・け
      console.log('売 Using incremental update mode for channels');

      enrichedSubscriptions = await Promise.all(
        cachedChannels.map(async (cached) => {
          try {
            const channelId = cached.channelId;
            const lastPublishedAt = cached.latestVideoPublishedAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 繝・ヵ繧ｩ繝ｫ繝・譌･蜑・

            // 蟾ｮ蛻・叙蠕暦ｼ壽怙邨ゅメ繧ｧ繝・け譌･譎ゆｻ･髯阪・蜍慕判縺ｮ縺ｿ
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
              // 譁ｰ縺励＞蜍慕判縺後↑縺・ｴ蜷医・繧ｭ繝｣繝・す繝･繧偵◎縺ｮ縺ｾ縺ｾ霑斐☆
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
            // 繧ｨ繝ｩ繝ｼ譎ゅ・繧ｭ繝｣繝・す繝･繧偵◎縺ｮ縺ｾ縺ｾ霑斐☆
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
      // 蜈ｨ蜿門ｾ励Δ繝ｼ繝会ｼ壼・蝗槭∪縺溘・ 繧ｭ繝｣繝・す繝･縺ｪ縺・
      console.log('踏 Using full fetch mode for channels');
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

    // 3. MongoDB cache save
if (mongoose.connection.readyState === 1) {
  try {
    const extended: any[] = [];
for (const sub of enrichedSubscriptions as any[]) {
  const chId = sub.snippet?.resourceId?.channelId as string | undefined;
  const title: string = (sub.snippet?.title || '').toLowerCase();
  let isArtist = !!(title.includes('- topic') || (chId && YouTubeApiService.isYouTubeMusicChannel(chId)));
  if (!isArtist && chId) {
    try {
      const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
      isArtist = await ytService.isMusicChannelAsync(chId, 5);
    } catch {}
  }
  extended.push({ sub, isArtist });
}
const bulkOps = extended.map(({ sub, isArtist }) => ({
      updateOne: {
        filter: {
          userId: req.userId,
          channelId: sub.snippet?.resourceId?.channelId
        },
        update: {
          $set: {
            channelTitle: sub.snippet?.title,
            channelDescription: sub.snippet?.description,
            thumbnailUrl: sub.snippet?.thumbnails?.high?.url ||
                         sub.snippet?.thumbnails?.medium?.url ||
                         sub.snippet?.thumbnails?.default?.url,
            latestVideoId: sub.latestVideoId,
            latestVideoThumbnail: sub.latestVideoThumbnail,
            latestVideoTitle: sub.latestVideoTitle,
            latestVideoPublishedAt: sub.latestVideoPublishedAt,
            subscriptionId: sub.id,
            isArtist: isArtist,
            cachedAt: new Date()
          },
          $setOnInsert: {
            userId: req.userId,
            channelId: sub.snippet?.resourceId?.channelId
          }
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
    // 4. レスポンスはアーティスト以外に限定
    try {
const marked = await Promise.all(
        enrichedSubscriptions.map(async (sub: any) => {
          const chId = sub.snippet?.resourceId?.channelId as string | undefined;
          const title: string = (sub.snippet?.title || '').toLowerCase();
          let isArtist = !!(title.includes('- topic') || (chId && YouTubeApiService.isYouTubeMusicChannel(chId)));
          if (!isArtist && chId) {
            try {
              const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
              isArtist = await ytService.isMusicChannelAsync(chId, 5);
            } catch {}
          }
          return { sub, isArtist };
        })
      );
      res.json(marked.filter(m => !m.isArtist).map(m => m.sub));
    } catch {
      // 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ縺ｨ縺励※蠕捺擂縺ｮ驟榊・繧定ｿ斐☆
      res.json(enrichedSubscriptions);
    }
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

/**
 * POST /api/channels
 * 繝√Ε繝ｳ繝阪Ν繧堤匳骭ｲ
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { channelId } = req.body;
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const subscription = await ytService.subscribe(channelId);

    // MongoDB縺ｮ繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢・域ｬ｡蝗槫叙蠕玲凾縺ｫ蜀阪く繝｣繝・す繝･・・
    if (mongoose.connection.readyState === 1) {
      try {
        await CachedChannel.deleteMany({ userId: req.userId });
        console.log('笨・Cleared MongoDB channel cache after subscription');
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
 * 繝√Ε繝ｳ繝阪Ν縺ｮ逋ｻ骭ｲ繧定ｧ｣髯､
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    await ytService.unsubscribe(req.params.id);

    // MongoDB縺九ｉ隧ｲ蠖薙メ繝｣繝ｳ繝阪Ν繧貞炎髯､
    if (mongoose.connection.readyState === 1) {
      try {
        await CachedChannel.deleteOne({
          userId: req.userId,
          subscriptionId: req.params.id
        });
        console.log('笨・Removed channel from MongoDB cache');
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
