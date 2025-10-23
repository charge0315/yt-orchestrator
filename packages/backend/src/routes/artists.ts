/**
 * 繧｢繝ｼ繝・ぅ繧ｹ繝茨ｼ・ouTube Music諠ｳ螳壹メ繝｣繝ｳ繝阪Ν・峨Ν繝ｼ繝・ */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import { CachedChannel } from '../models/CachedChannel.js';

const router = express.Router();

router.use(authenticate);

// GET /api/artists
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    // 1) 繧ｭ繝｣繝・す繝･蜆ｪ蜈・    const cachedDocs = await CachedChannel.find({ userId: req.userId, isArtist: true });
    if (cachedDocs.length > 0) {
      // 24譎る俣莉･蜀・・繧ｭ繝｣繝・す繝･縺ｧ縺ゅｌ縺ｰ縺昴ｌ繧定ｿ斐☆・井ｸ崎ｶｳ縺ｯ霆ｽ驥剰｣懷ｮ鯉ｼ・      const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24譎る俣
      const oldestCache = cachedDocs.reduce((oldest: any, current: any) =>
        current.cachedAt < oldest.cachedAt ? current : oldest
      );
      const cacheAge = Date.now() - new Date(oldestCache.cachedAt).getTime();
      if (cacheAge < CACHE_DURATION_MS) {
        // 譛譁ｰ蜍慕判諠・ｱ縺梧ｬ關ｽ縺励※縺・ｋ蝣ｴ蜷医・縺ｿ霆ｽ驥上↓陬懷ｮ・        let ytForEnrich: YouTubeApiService | undefined;
        const enriched = await Promise.all(
          cachedDocs.map(async (doc) => {
            if (doc.latestVideoId && doc.latestVideoTitle && doc.latestVideoThumbnail) {
              return doc;
            }
            try {
              if (!ytForEnrich) {
                ytForEnrich = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
              }
              const vids = await ytForEnrich.getChannelVideos(doc.channelId, 1);
              const latest = vids?.[0];
              if (latest) {
                doc.latestVideoId = latest.id?.videoId || (latest as any).id;
                doc.latestVideoTitle = latest.snippet?.title;
                doc.latestVideoThumbnail = latest.snippet?.thumbnails?.high?.url || latest.snippet?.thumbnails?.medium?.url || latest.snippet?.thumbnails?.default?.url;
                doc.latestVideoPublishedAt = latest.snippet?.publishedAt ? new Date(latest.snippet.publishedAt) : doc.latestVideoPublishedAt;
                doc.cachedAt = new Date();
                try { await doc.save(); } catch {}
              }
            } catch {}
            return doc;
          })
        );

        const formatted = enriched.map(ch => ({
          id: ch.subscriptionId || ch.channelId,
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
          latestVideoThumbnail: ch.latestVideoThumbnail,
          latestVideoTitle: ch.latestVideoTitle,
          latestVideoId: ch.latestVideoId,
          latestVideoPublishedAt: ch.latestVideoPublishedAt
        }));
        return res.json(formatted);
      }
    }

    // 2) 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・唳ouTube API縺九ｉ雉ｼ隱ｭ繝√Ε繝ｳ繝阪Ν蜿門ｾ冷・繧｢繝ｼ繝・ぅ繧ｹ繝亥愛螳壺・譛譁ｰ蜍慕判莉倅ｸ・    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const subs = await yt.getSubscriptions();

    const enriched = await Promise.all(
      subs.items.map(async (sub: any) => {
        const chId: string | undefined = sub.snippet?.resourceId?.channelId;
        if (!chId) return null;

        let isArtist = (sub.snippet?.title || '').toLowerCase().includes('- topic') ||
                       YouTubeApiService.isYouTubeMusicChannel(chId);
        if (!isArtist) {
          try { isArtist = await yt.isMusicChannelAsync(chId, 5); } catch {}
        }
        if (!isArtist) return null;

        try {
          const vids = await yt.getChannelVideos(chId, 1);
          const latest = vids?.[0];
          return {
            id: sub.id,
            snippet: sub.snippet,
            latestVideoId: latest?.id?.videoId || latest?.id,
            latestVideoThumbnail: latest?.snippet?.thumbnails?.high?.url || latest?.snippet?.thumbnails?.medium?.url || latest?.snippet?.thumbnails?.default?.url,
            latestVideoTitle: latest?.snippet?.title,
            latestVideoPublishedAt: latest?.snippet?.publishedAt ? new Date(latest.snippet.publishedAt) : undefined
          };
        } catch {
          return { id: sub.id, snippet: sub.snippet };
        }
      })
    );

    const artists = enriched.filter(Boolean);

    //
    if (artists.length > 0) {
      try {
        await CachedChannel.bulkWrite(
          artists.map((a: any) => ({
            updateOne: {
              filter: { userId: req.userId, channelId: a.snippet?.resourceId?.channelId },
              update: {
                channelTitle: a.snippet?.title,
                channelDescription: a.snippet?.description,
                thumbnailUrl: a.snippet?.thumbnails?.high?.url || a.snippet?.thumbnails?.medium?.url || a.snippet?.thumbnails?.default?.url,
                latestVideoId: a.latestVideoId,
                latestVideoThumbnail: a.latestVideoThumbnail,
                latestVideoTitle: a.latestVideoTitle,
                latestVideoPublishedAt: a.latestVideoPublishedAt,
                subscriptionId: a.id,
                isArtist: true,
                cachedAt: new Date()
              },
              upsert: true
            }
          }))
        );
      } catch {}
    }

    return res.json(artists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

// POST /api/artists
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { channelId } = req.body;
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const subscription = await yt.subscribe(channelId);
    res.status(201).json(subscription);
  } catch (error) {
    res.status(500).json({ error: 'Failed to subscribe to artist' });
  }
});

// DELETE /api/artists/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    await yt.unsubscribe(req.params.id);
    res.json({ message: 'Unsubscribed from artist successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe from artist' });
  }
});

// GET /api/artists/new-releases
router.get('/new-releases', async (req: AuthRequest, res: Response) => {
  try {
    let cached = await CachedChannel
      .find({ userId: req.userId, isArtist: true, latestVideoId: { $exists: true, $ne: null } })
      .sort({ latestVideoPublishedAt: -1 })
      .limit(20)
      .lean();

    if (cached.length === 0) {
      const artists = await CachedChannel.find({ userId: req.userId, isArtist: true }).lean();
      const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
      const updated = await Promise.all(
        artists.slice(0, 20).map(async (ch: any) => {
          try {
            const vids = await yt.getChannelVideos(ch.channelId, 1);
            const latest = vids?.[0];
            if (latest) {
              return {
                ...ch,
                latestVideoId: latest.id?.videoId || latest.id,
                latestVideoThumbnail: latest.snippet?.thumbnails?.high?.url || latest.snippet?.thumbnails?.medium?.url || latest.snippet?.thumbnails?.default?.url,
                latestVideoTitle: latest.snippet?.title,
                latestVideoPublishedAt: latest.snippet?.publishedAt ? new Date(latest.snippet.publishedAt) : undefined
              };
            }
          } catch {}
          return ch;
        })
      );
      try {
        await CachedChannel.bulkWrite(
          updated.map((u: any) => ({
            updateOne: {
              filter: { userId: req.userId, channelId: u.channelId },
              update: {
                latestVideoId: u.latestVideoId,
                latestVideoThumbnail: u.latestVideoThumbnail,
                latestVideoTitle: u.latestVideoTitle,
                latestVideoPublishedAt: u.latestVideoPublishedAt,
                cachedAt: new Date()
              },
              upsert: true
            }
          }))
        );
      } catch {}
      cached = updated.filter((c: any) => !!c.latestVideoId);
    }

    const newReleases = cached.map(ch => ({
      id: { videoId: ch.latestVideoId },
      videoId: ch.latestVideoId,
      snippet: {
        channelId: ch.channelId,
        channelTitle: ch.channelTitle,
        title: ch.latestVideoTitle,
        thumbnails: {
          default: { url: ch.latestVideoThumbnail },
          medium: { url: ch.latestVideoThumbnail },
          high: { url: ch.latestVideoThumbnail }
        },
        publishedAt: ch.latestVideoPublishedAt
      },
      title: ch.latestVideoTitle,
      thumbnail: ch.latestVideoThumbnail
    }));

    return res.json(newReleases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get new releases' });
  }
});

export default router;
