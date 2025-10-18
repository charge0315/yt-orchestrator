/**
 * プレイリスト管理ルート
 * YouTube Data API v3と直接連携してプレイリストを管理
 * MongoDB優先でキャッシュを活用
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';
import { CachedPlaylist } from '../models/CachedPlaylist.js';
import mongoose from 'mongoose';

const router = express.Router();

// すべてのルートで認証を必須にする
router.use(authenticate);

/**
 * GET /api/playlists
 * ユーザーのプレイリスト一覧を取得
 * MongoDB優先、APIをフォールバックとして使用
 * クエリパラメータ: pageToken (オプション)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { pageToken } = req.query;
    const CACHE_DURATION_MS = 30 * 60 * 1000; // 30分

    // pageTokenがある場合はAPIから直接取得（ページネーション中）
    if (pageToken) {
      const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
      const result = await ytService.getPlaylists(pageToken as string);
      const videoPlaylists = result.items.filter((playlist: any) =>
        !ytService.isMusicPlaylist(playlist)
      );
      return res.json({
        items: videoPlaylists,
        nextPageToken: result.nextPageToken
      });
    }

    // 1. MongoDBからキャッシュを取得
    if (mongoose.connection.readyState === 1) {
      const cachedPlaylists = await CachedPlaylist.find({ userId: req.userId });

      if (cachedPlaylists.length > 0) {
        // キャッシュの有効期限をチェック
        const oldestCache = cachedPlaylists.reduce((oldest, current) =>
          current.cachedAt < oldest.cachedAt ? current : oldest
        );
        const cacheAge = Date.now() - oldestCache.cachedAt.getTime();

        if (cacheAge < CACHE_DURATION_MS) {
          console.log(`✅ Returning ${cachedPlaylists.length} playlists from MongoDB cache (${Math.round(cacheAge / 1000 / 60)}min old)`);

          // YouTube API形式に変換して返す
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
        } else {
          console.log('⚠️  MongoDB playlist cache is stale, fetching from YouTube API');
        }
      } else {
        console.log('⚠️  No playlists found in MongoDB cache, fetching from YouTube API');
      }
    } else {
      console.log('⚠️  MongoDB not connected, using YouTube API directly');
    }

    // 2. YouTube APIから取得
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const result = await ytService.getPlaylists();

    const videoPlaylists = result.items.filter((playlist: any) =>
      !ytService.isMusicPlaylist(playlist)
    );

    // 3. MongoDBにキャッシュを保存
    if (mongoose.connection.readyState === 1) {
      try {
        const bulkOps = videoPlaylists.map((pl: any) => ({
          updateOne: {
            filter: {
              userId: req.userId,
              playlistId: pl.id
            },
            update: {
              title: pl.snippet?.title,
              description: pl.snippet?.description,
              thumbnailUrl: pl.snippet?.thumbnails?.high?.url ||
                           pl.snippet?.thumbnails?.medium?.url ||
                           pl.snippet?.thumbnails?.default?.url,
              itemCount: pl.contentDetails?.itemCount,
              channelId: pl.snippet?.channelId,
              channelTitle: pl.snippet?.channelTitle,
              privacy: pl.status?.privacyStatus,
              cachedAt: new Date()
            },
            upsert: true
          }
        }));

        await CachedPlaylist.bulkWrite(bulkOps);
        console.log(`✅ Saved ${videoPlaylists.length} playlists to MongoDB cache`);
      } catch (dbError) {
        console.error('Failed to save playlists to MongoDB:', dbError);
      }
    }

    res.json({
      items: videoPlaylists,
      nextPageToken: result.nextPageToken
    });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.json({ items: [], nextPageToken: undefined });
  }
});

/**
 * GET /api/playlists/:id
 * 特定のプレイリストの詳細を取得
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const playlist = await ytService.getPlaylist(req.params.id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

/**
 * POST /api/playlists
 * 新しいプレイリストを作成
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const playlist = await ytService.createPlaylist(name, description);

    // MongoDBキャッシュをクリア（次回取得時に再キャッシュ）
    if (mongoose.connection.readyState === 1) {
      try {
        await CachedPlaylist.deleteMany({ userId: req.userId });
        console.log('✅ Cleared MongoDB playlist cache after creation');
      } catch (dbError) {
        console.error('Failed to clear playlist cache:', dbError);
      }
    }

    res.status(201).json(playlist);
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

/**
 * PUT /api/playlists/:id
 * プレイリストの情報を更新
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const playlist = await ytService.updatePlaylist(req.params.id, name, description);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // MongoDBキャッシュを更新
    if (mongoose.connection.readyState === 1) {
      try {
        await CachedPlaylist.findOneAndUpdate(
          { userId: req.userId, playlistId: req.params.id },
          { title: name, description, cachedAt: new Date() }
        );
        console.log('✅ Updated playlist in MongoDB cache');
      } catch (dbError) {
        console.error('Failed to update playlist cache:', dbError);
      }
    }

    res.json(playlist);
  } catch (error) {
    console.error('Error updating playlist:', error);
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

/**
 * DELETE /api/playlists/:id
 * プレイリストを削除
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    await ytService.deletePlaylist(req.params.id);

    // MongoDBから削除
    if (mongoose.connection.readyState === 1) {
      try {
        await CachedPlaylist.deleteOne({
          userId: req.userId,
          playlistId: req.params.id
        });
        console.log('✅ Removed playlist from MongoDB cache');
      } catch (dbError) {
        console.error('Failed to remove playlist from cache:', dbError);
      }
    }

    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

/**
 * POST /api/playlists/:id/songs
 * プレイリストに曲（動画）を追加
 */
router.post('/:id/songs', async (req: AuthRequest, res: Response) => {
  try {
    const { videoId } = req.body;
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const result = await ytService.addToPlaylist(req.params.id, videoId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add song to playlist' });
  }
});

/**
 * DELETE /api/playlists/:id/songs/:playlistItemId
 * プレイリストから曲（動画）を削除
 */
router.delete('/:id/songs/:playlistItemId', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    await ytService.removeFromPlaylist(req.params.playlistItemId);
    res.json({ message: 'Song removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove song from playlist' });
  }
});

export default router;
