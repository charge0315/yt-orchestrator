/**
 * アーティスト（YouTube Music想定チャンネル）ルート
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import { CachedChannel } from '../models/CachedChannel.js';

const router = express.Router();

router.use(authenticate);

// GET /api/artists
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    // 1) キャッシュ優先
    const cached = await CachedChannel.find({ userId: req.userId, isArtist: true }).lean();
    if (cached.length > 0) {
      const formatted = cached.map(ch => ({
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

    // 2) フォールバック：YouTube APIから購読チャンネル取得→アーティスト判定→最新動画付与
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
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

    // 3) キャッシュ保存
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

