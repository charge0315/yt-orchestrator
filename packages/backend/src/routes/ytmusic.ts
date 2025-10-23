/**
 * YouTube Music莠呈鋤繝ｫ繝ｼ繝・ * YouTube Data API v3繧剃ｽｿ逕ｨ縺励※YouTube Music縺ｮ讖溯・繧呈署萓・ * 豕ｨ: YouTube Music縺ｯYouTube縺ｮ荳驛ｨ縺ｪ縺ｮ縺ｧ縲∝酔縺連PI繧剃ｽｿ逕ｨ縺ｧ縺阪∪縺・ */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import { CachedPlaylist } from '../models/CachedPlaylist.js';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/ytmusic/auth/status
 * YouTube Music謗･邯夂憾諷九ｒ遒ｺ隱・ * 豕ｨ: YouTube Data API繧剃ｽｿ逕ｨ縺励※縺・ｋ縺溘ａ縲∝ｸｸ縺ｫ謗･邯壽ｸ医∩
 */
router.get('/auth/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // YouTube Data API v3繧剃ｽｿ逕ｨ縺励※縺・ｋ縺溘ａ縲・    // Google OAuth縺悟ｮ御ｺ・＠縺ｦ縺・ｌ縺ｰ閾ｪ蜍慕噪縺ｫ謗･邯壽ｸ医∩
    res.json({
      connected: true,
      message: 'YouTube Data API v3 を使用しているため、常に接続済みです'
    });
  } catch (error) {
    console.error('Error checking YouTube Music status:', error);
    res.status(500).json({ error: 'Failed to check YouTube Music status' });
  }
});

/**
 * GET /api/ytmusic/playlists
 * YouTube Music繝励Ξ繧､繝ｪ繧ｹ繝井ｸ隕ｧ繧貞叙蠕・ * 繝励Ξ繧､繝ｪ繧ｹ繝亥・縺ｮ蜍慕判縺ｮ繧ｫ繝・ざ繝ｪID繧偵メ繧ｧ繝・け縺励※髻ｳ讌ｽ邉ｻ縺ｮ繧ゅ・縺ｮ縺ｿ繧偵ヵ繧｣繝ｫ繧ｿ繝ｪ繝ｳ繧ｰ
 * 繧ｯ繧ｨ繝ｪ繝代Λ繝｡繝ｼ繧ｿ: pageToken (繧ｪ繝励す繝ｧ繝ｳ)
 */
router.get('/playlists', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    console.log('凍 YouTube Music playlists request received');
    const force = (req.query.force as string | undefined) === '1' || (req.query.refresh as string | undefined) === '1' 
    if (force) {
      try {
        const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
        const result = await ytService.getPlaylists();
        const musicOnly = (result.items || []).filter((pl: any) => ytService.isMusicPlaylist(pl));
        return res.json({ items: musicOnly, nextPageToken: result.nextPageToken });
      } catch (e) {
        console.error('Force fetch YT Music playlists failed:', e);
        return res.json({ items: [], nextPageToken: undefined });
      }
    }

    // MongoDB縺九ｉ蜈ｨ繝励Ξ繧､繝ｪ繧ｹ繝医・繧ｭ繝｣繝・す繝･繧貞叙蠕暦ｼ医け繧ｩ繝ｼ繧ｿ遽邏・ｼ・    // API繧ｯ繧ｩ繝ｼ繧ｿ雜・℃譎ゅ・髻ｳ讌ｽ繝輔ぅ繝ｫ繧ｿ繧貞､悶＠縺ｦ蜈ｨ繝励Ξ繧､繝ｪ繧ｹ繝医ｒ陦ｨ遉ｺ
    if (mongoose.connection.readyState === 1) {
      // 髻ｳ讌ｽ繝励Ξ繧､繝ｪ繧ｹ繝医・縺ｿ繧定ｿ斐☆
      const cachedPlaylists = await CachedPlaylist.find({
        userId: req.userId,
        isMusicPlaylist: true
      });

      if (cachedPlaylists.length > 0) {
        // 繧ｭ繝｣繝・す繝･縺ｮ蟷ｴ鮨｢繧定ｨ育ｮ暦ｼ域ュ蝣ｱ陦ｨ遉ｺ逕ｨ・・        const oldestCache = cachedPlaylists.reduce((oldest, current) =>
          current.cachedAt < oldest.cachedAt ? current : oldest
        );
        const cacheAge = Date.now() - oldestCache.cachedAt.getTime();
        const cacheAgeMinutes = Math.round(cacheAge / 1000 / 60);
        const cacheAgeHours = Math.round(cacheAge / 1000 / 60 / 60);

        const ageDisplay = cacheAgeHours >= 1
          ? `${cacheAgeHours}h old`
          : `${cacheAgeMinutes}min old`;

        console.log(`凍 Returning ${cachedPlaylists.length} YouTube Music playlists from MongoDB cache (${ageDisplay})`);

        // YouTube API蠖｢蠑上↓螟画鋤縺励※霑斐☆
        const formattedPlaylists = cachedPlaylists.map(pl => ({
          kind: 'youtube#playlist',
          id: pl.playlistId,
          snippet: {
            title: pl.title,
            description: pl.description,
            thumbnails: {
              default: { url: pl.thumbnailUrl },
              medium: { url: pl.thumbnailUrl },
              high: { url: pl.thumbnailUrl }
            },
            channelId: pl.channelId,
            channelTitle: pl.channelTitle
          },
          contentDetails: {
            itemCount: pl.itemCount
          },
          status: {
            privacyStatus: pl.privacy
          }
        }));

        return res.json({
          items: formattedPlaylists,
          nextPageToken: undefined
        });
      }

      console.log('笞・・ MongoDB music playlist cache is empty, fetching from API');
      return res.json({ items: [], nextPageToken: undefined });
    }

    // MongoDB縺悟茜逕ｨ縺ｧ縺阪↑縺・ｴ蜷・    console.log('笞・・ MongoDB not connected, returning empty for music playlists');
    res.json({ items: [], nextPageToken: undefined });
  } catch (error: any) {
    console.error('笶・Error fetching YouTube Music playlists:', error);
    res.json({ items: [], nextPageToken: undefined });
  }
});

/**
 * GET /api/ytmusic/playlists/:id
 * 迚ｹ螳壹・繝励Ξ繧､繝ｪ繧ｹ繝医・隧ｳ邏ｰ繧貞叙蠕・ */
router.get('/playlists/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const playlist = await ytService.getPlaylist(req.params.id);

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // 繝励Ξ繧､繝ｪ繧ｹ繝医・繧｢繧､繝・Β繧ょ叙蠕・    const itemsResult = await ytService.getPlaylistItems(req.params.id);

    const transformedPlaylist = {
      _id: playlist.id,
      name: playlist.snippet?.title || '',
      description: playlist.snippet?.description || '',
      thumbnail: playlist.snippet?.thumbnails?.default?.url,
      songs: itemsResult.items.map((item: any) => ({
        videoId: item.snippet?.resourceId?.videoId,
        title: item.snippet?.title,
        artist: item.snippet?.videoOwnerChannelTitle || 'Unknown Artist',
        thumbnail: item.snippet?.thumbnails?.default?.url,
        addedAt: new Date(item.snippet?.publishedAt)
      })),
      createdAt: playlist.snippet?.publishedAt ? new Date(playlist.snippet.publishedAt) : new Date(),
      updatedAt: new Date()
    };

    res.json(transformedPlaylist);
  } catch (error) {
    console.error('Error fetching YouTube Music playlist:', error);
    res.status(500).json({ error: 'Failed to fetch YouTube Music playlist' });
  }
});

/**
 * GET /api/ytmusic/search
 * 蜍慕判繧呈､懃ｴ｢・・ouTube Music縺ｨ縺励※・・ */
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);

    // YouTube Data API縺ｮsearch讖溯・繧剃ｽｿ逕ｨ
    // 髻ｳ讌ｽ繧ｫ繝・ざ繝ｪ・・ategoryId=10・峨〒繝輔ぅ繝ｫ繧ｿ繝ｪ繝ｳ繧ｰ
    const results = await ytService.searchVideos(query, 20);

    const transformedResults = results.map((video: any) => ({
      videoId: video.id?.videoId,
      title: video.snippet?.title,
      artist: video.snippet?.channelTitle || 'Unknown Artist',
      thumbnail: video.snippet?.thumbnails?.default?.url
    }));

    res.json(transformedResults);
  } catch (error) {
    console.error('Error searching YouTube Music:', error);
    res.status(500).json({ error: 'Failed to search YouTube Music' });
  }
});

export default router;
