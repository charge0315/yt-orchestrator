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
 * DELETE /api/playlists/cache
 * MongoDBキャッシュをクリア（開発用）
 */
router.delete('/cache', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const result = await CachedPlaylist.deleteMany({ userId: req.userId });
      console.log(`🗑️  Cleared ${result.deletedCount} playlists from cache for user ${req.userId}`);
      res.json({ message: `Cleared ${result.deletedCount} playlists from cache` });
    } else {
      res.status(503).json({ error: 'MongoDB not connected' });
    }
  } catch (error) {
    console.error('Error clearing playlist cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * GET /api/playlists
 * ユーザーのプレイリスト一覧を取得
 * MongoDB優先、APIをフォールバックとして使用
 * クエリパラメータ: pageToken (オプション)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { pageToken } = req.query;
    const type = (req.query.type as string | undefined)?.toLowerCase() as 'video' | 'music' | 'all' | undefined;
    const desiredType: 'video' | 'music' | 'all' = type === 'music' || type === 'all' ? type : 'video';
    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24時間（1日）

    // pageTokenがある場合はAPIから直接取得（ページネーション中）
    if (pageToken) {
      const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
      const result = await ytService.getPlaylists(pageToken as string);
      const classified = result.items.map((playlist: any) => ({
        ...playlist,
        isMusicPlaylist: ytService.isMusicPlaylist(playlist)
      }));
      const filtered = desiredType === 'all'
        ? classified
        : classified.filter((pl: any) => desiredType === 'music' ? pl.isMusicPlaylist : !pl.isMusicPlaylist);
      return res.json({
        items: filtered,
        nextPageToken: result.nextPageToken
      });
    }

    // 1. MongoDBからキャッシュを取得
    let cachedPlaylists: any[] = [];
    if (mongoose.connection.readyState === 1) {
      cachedPlaylists = await CachedPlaylist.find({ userId: req.userId });

      if (cachedPlaylists.length > 0) {
        // キャッシュの有効期限をチェック
        const oldestCache = cachedPlaylists.reduce((oldest, current) =>
          current.cachedAt < oldest.cachedAt ? current : oldest
        );
        const cacheAge = Date.now() - oldestCache.cachedAt.getTime();
        const cacheAgeHours = Math.round(cacheAge / 1000 / 60 / 60);
        const cacheAgeMinutes = Math.round(cacheAge / 1000 / 60);

        if (cacheAge < CACHE_DURATION_MS) {
          const ageDisplay = cacheAgeHours >= 1
            ? `${cacheAgeHours}h old`
            : `${cacheAgeMinutes}min old`;

          console.log(`✅ Returning ${cachedPlaylists.length} playlists from MongoDB cache (${ageDisplay})`);

          // YouTube API形式に変換して返す
          const filteredCached = desiredType === 'all'
            ? cachedPlaylists
            : cachedPlaylists.filter(pl => desiredType === 'music' ? !!pl.isMusicPlaylist : !pl.isMusicPlaylist);

          const formattedPlaylists = filteredCached.map(pl => ({
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
            },
            isMusicPlaylist: pl.isMusicPlaylist === true
          }));

          return res.json({
            items: formattedPlaylists,
            nextPageToken: undefined
          });
        } else {
          console.log('⚠️  MongoDB playlist cache is stale (>24h), fetching from YouTube API');
        }
      } else {
        console.log('⚠️  No playlists found in MongoDB cache, fetching from YouTube API');
      }
    } else {
      console.log('⚠️  MongoDB not connected, using YouTube API directly');
    }

    // 2. YouTube APIから差分取得（ETag使用）
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);

    // キャッシュがある場合はETagを使用
    let playlistsWithType: any[] = [];

    if (cachedPlaylists.length > 0) {
      // 差分更新モード：ETagを使用して変更チェック
      console.log('🔄 Using ETag-based incremental update for playlists');

      // 最初のプレイリストのETagを取得（全体のETag）
      const cachedEtag = cachedPlaylists[0]?.etag;
      const result = await ytService.getPlaylists(undefined, cachedEtag);

      if (result.etag && result.etag === cachedEtag) {
        // ETagが一致 = 変更なし（既にキャッシュを返している）
        console.log('📊 ETag match: Playlists not modified (using cached data)');
      }

      playlistsWithType = result.items.map((playlist: any) => ({
        ...playlist,
        isMusicPlaylist: ytService.isMusicPlaylist(playlist)
      }));
    } else {
      // 全取得モード
      console.log('📥 Using full fetch mode for playlists');
      const playlistsResult = await ytService.getPlaylists();
      playlistsWithType = playlistsResult.items.map((playlist: any) => ({
        ...playlist,
        isMusicPlaylist: ytService.isMusicPlaylist(playlist)
      }));
    }

    // 3. MongoDBにキャッシュを保存
    if (mongoose.connection.readyState === 1 && playlistsWithType.length > 0) {
      try {
        // 音楽判定キーワード
        const bulkOps = playlistsWithType.map((pl: any) => {
          const isMusicPlaylist = !!pl.isMusicPlaylist;

          return {
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
                isMusicPlaylist: isMusicPlaylist,
                etag: pl.etag, // ETagを保存
                cachedAt: new Date()
              },
              upsert: true
            }
          };
        });

        await CachedPlaylist.bulkWrite(bulkOps);
        console.log(`✅ Saved ${playlistsWithType.length} playlists to MongoDB cache`);
      } catch (dbError) {
        console.error('Failed to save playlists to MongoDB:', dbError);
      }
    }

    const responseItems = desiredType === 'all'
      ? playlistsWithType
      : playlistsWithType.filter((pl: any) => desiredType === 'music' ? pl.isMusicPlaylist : !pl.isMusicPlaylist);

    res.json({
      items: responseItems,
      nextPageToken: undefined
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

/**
 * GET /api/playlists/:id/export
 * プレイリストをJSON形式でエクスポート
 * プレイリスト情報と全ての動画情報を含む
 */
router.get('/:id/export', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);

    // プレイリスト情報を取得
    const playlist = await ytService.getPlaylist(req.params.id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // プレイリストアイテム（動画）を取得
    const itemsResult = await ytService.getPlaylistItems(req.params.id);
    const items = itemsResult.items || [];

    // エクスポート用のデータ構造を作成
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      playlist: {
        title: playlist.snippet?.title,
        description: playlist.snippet?.description,
        privacy: playlist.status?.privacyStatus || 'private'
      },
      items: items.map((item: any) => ({
        videoId: item.snippet?.resourceId?.videoId,
        title: item.snippet?.title,
        description: item.snippet?.description,
        channelTitle: item.snippet?.channelTitle,
        channelId: item.snippet?.channelId,
        thumbnail: item.snippet?.thumbnails?.high?.url ||
                   item.snippet?.thumbnails?.medium?.url ||
                   item.snippet?.thumbnails?.default?.url,
        position: item.snippet?.position
      }))
    };

    // ファイル名を生成（プレイリスト名をサニタイズ）
    const sanitizedTitle = playlist.snippet?.title
      ?.replace(/[^a-z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/gi, '_')
      ?.substring(0, 50) || 'playlist';
    const filename = `${sanitizedTitle}_${new Date().getTime()}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);

    console.log(`✅ Exported playlist "${playlist.snippet?.title}" (${exportData.items.length} items)`);
  } catch (error) {
    console.error('Error exporting playlist:', error);
    res.status(500).json({ error: 'Failed to export playlist' });
  }
});

/**
 * POST /api/playlists/import
 * JSON形式でプレイリストをインポート
 * 新しいプレイリストを作成し、全ての動画を追加
 */
router.post('/import', async (req: AuthRequest, res: Response) => {
  try {
    const { playlist, items } = req.body;

    if (!playlist || !playlist.title) {
      return res.status(400).json({ error: 'Invalid import data: playlist title is required' });
    }

    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);

    // 新しいプレイリストを作成
    const newPlaylist = await ytService.createPlaylist(
      playlist.title,
      playlist.description || ''
    );

    if (!newPlaylist || !newPlaylist.id) {
      return res.status(500).json({ error: 'Failed to create playlist' });
    }

    console.log(`✅ Created new playlist "${playlist.title}" (ID: ${newPlaylist.id})`);

    // 動画を追加（順番を保持）
    const sortedItems = Array.isArray(items)
      ? [...items].sort((a, b) => (a.position || 0) - (b.position || 0))
      : [];

    let addedCount = 0;
    let failedCount = 0;

    for (const item of sortedItems) {
      if (item.videoId) {
        try {
          await ytService.addToPlaylist(newPlaylist.id, item.videoId);
          addedCount++;
          console.log(`  ✓ Added: ${item.title}`);
        } catch (error) {
          failedCount++;
          console.error(`  ✗ Failed to add: ${item.title}`, error);
        }
      }
    }

    // MongoDBキャッシュをクリア（次回取得時に再キャッシュ）
    if (mongoose.connection.readyState === 1) {
      try {
        await CachedPlaylist.deleteMany({ userId: req.userId });
        console.log('✅ Cleared MongoDB playlist cache after import');
      } catch (dbError) {
        console.error('Failed to clear playlist cache:', dbError);
      }
    }

    console.log(`✅ Import completed: ${addedCount} added, ${failedCount} failed`);

    res.status(201).json({
      playlist: newPlaylist,
      stats: {
        total: sortedItems.length,
        added: addedCount,
        failed: failedCount
      }
    });
  } catch (error) {
    console.error('Error importing playlist:', error);
    res.status(500).json({ error: 'Failed to import playlist' });
  }
});

export default router;
