/**
 * プレイリスト ルーター（UTF-8 正規化版）
 * - YouTube Data API v3 と直接連携
 * - MongoDB キャッシュ優先（24時間）
 * - 差分更新（ETag）と日次制限（1日1回）に対応
 */
import express, { Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { YouTubeApiService } from '../services/youtubeApi.js'
import { CachedPlaylist } from '../models/CachedPlaylist.js'
import { Playlist } from '../models/Playlist.js'
import mongoose from 'mongoose'

const router = express.Router()

// 全ルートで認証必須
router.use(authenticate)

/**
 * DELETE /api/playlists/cache
 * MongoDB キャッシュをクリア（開発用）
 */
router.delete('/cache', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const result = await CachedPlaylist.deleteMany({ userId: req.userId })
      console.log(`🗑 Cleared ${result.deletedCount} playlists from cache for user ${req.userId}`)
      res.json({ message: `Cleared ${result.deletedCount} playlists from cache` })
    } else {
      res.status(503).json({ error: 'MongoDB not connected' })
    }
  } catch (error) {
    console.error('Error clearing playlist cache:', error)
    res.status(500).json({ error: 'Failed to clear cache' })
  }
})

/**
 * GET /api/playlists
 * プレイリスト一覧を返却（MongoDBの内容をそのまま提供）
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ items: [], nextPageToken: undefined });
    }

    const cachedPlaylists = await CachedPlaylist.find({ userId: req.userId }).sort({ cachedAt: -1 }).lean();
    const formatted = cachedPlaylists.map((pl) => ({
      kind: 'youtube#playlist',
      id: pl.playlistId,
      snippet: {
        title: pl.title,
        description: pl.description,
        thumbnails: {
          default: { url: pl.thumbnailUrl },
          medium: { url: pl.thumbnailUrl },
          high: { url: pl.thumbnailUrl },
        },
        channelId: pl.channelId,
        channelTitle: pl.channelTitle,
      },
      contentDetails: { itemCount: pl.itemCount },
      status: { privacyStatus: pl.privacy },
      isMusicPlaylist: pl.isMusicPlaylist === true,
    }));

    return res.json({ items: formatted, nextPageToken: undefined });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

/**
 * GET /api/playlists/:id
 * プレイリスト詳細
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB not connected' })
    }

    const playlist = await Playlist.findOne({ userId: req.userId, playlistId: req.params.id }).lean()
    const cachedSummary = await CachedPlaylist.findOne({ userId: req.userId, playlistId: req.params.id }).lean()

    if (!playlist && !cachedSummary) {
      return res.status(404).json({ error: 'Playlist not found' })
    }

    const songs = (playlist?.items || []).map((item: any) => ({
      videoId: item.videoId,
      title: item.title,
      artist: (item as any).artist || cachedSummary?.channelTitle || '',
      thumbnail: item.thumbnail,
      addedAt: item.addedAt,
      position: item.position,
    }))

    const updatedAt =
      (playlist as any)?.updatedAt ||
      (cachedSummary as any)?.updatedAt ||
      cachedSummary?.cachedAt;

    const responseBody = {
      id: playlist?.playlistId || cachedSummary?.playlistId || req.params.id,
      playlistId: playlist?.playlistId || cachedSummary?.playlistId || req.params.id,
      name: playlist?.title || cachedSummary?.title || '',
      description: playlist?.description || cachedSummary?.description || '',
      thumbnail: playlist?.thumbnail || cachedSummary?.thumbnailUrl,
      itemCount: playlist?.itemCount || cachedSummary?.itemCount || songs.length,
      songs,
      channelId: cachedSummary?.channelId,
      channelTitle: cachedSummary?.channelTitle,
      updatedAt,
    }

    res.json(responseBody)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlist' })
  }
})

/**
 * POST /api/playlists
 * プレイリストを作成
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const playlist = await yt.createPlaylist(name, description)
    if (mongoose.connection.readyState === 1) {
      try { await CachedPlaylist.deleteMany({ userId: req.userId }) } catch {}
    }
    res.status(201).json(playlist)
  } catch (error) {
    console.error('Error creating playlist:', error)
    res.status(500).json({ error: 'Failed to create playlist' })
  }
})

/**
 * PUT /api/playlists/:id
 * プレイリスト情報を更新
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const playlist = await yt.updatePlaylist(req.params.id, name, description)
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' })
    if (mongoose.connection.readyState === 1) {
      try {
        await CachedPlaylist.findOneAndUpdate(
          { userId: req.userId, playlistId: req.params.id },
          { title: name, description, cachedAt: new Date() }
        )
      } catch {}
    }
    res.json(playlist)
  } catch (error) {
    console.error('Error updating playlist:', error)
    res.status(500).json({ error: 'Failed to update playlist' })
  }
})

/**
 * DELETE /api/playlists/:id
 * プレイリストを削除
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    await yt.deletePlaylist(req.params.id)
    if (mongoose.connection.readyState === 1) {
      try { await CachedPlaylist.deleteOne({ userId: req.userId, playlistId: req.params.id }) } catch {}
    }
    res.json({ message: 'Playlist deleted successfully' })
  } catch (error) {
    console.error('Error deleting playlist:', error)
    res.status(500).json({ error: 'Failed to delete playlist' })
  }
})

/**
 * POST /api/playlists/:id/songs
 * プレイリストに曲（動画）を追加
 */
router.post('/:id/songs', async (req: AuthRequest, res: Response) => {
  try {
    const { videoId } = req.body
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const result = await yt.addToPlaylist(req.params.id, videoId)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: 'Failed to add song to playlist' })
  }
})

/**
 * DELETE /api/playlists/:id/songs/:playlistItemId
 * プレイリストから曲（動画）を削除
 */
router.delete('/:id/songs/:playlistItemId', async (req: AuthRequest, res: Response) => {
  try {
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    await yt.removeFromPlaylist(req.params.playlistItemId)
    res.json({ message: 'Song removed successfully' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove song from playlist' })
  }
})

/**
 * GET /api/playlists/:id/export
 * プレイリストをJSON形式でエクスポート
 */
router.get('/:id/export', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB not connected' })
    }

    const playlist = await Playlist.findOne({ userId: req.userId, playlistId: req.params.id }).lean()
    const cached = await CachedPlaylist.findOne({ userId: req.userId, playlistId: req.params.id }).lean()

    if (!playlist && !cached) {
      return res.status(404).json({ error: 'Playlist not found' })
    }

    const items = (playlist?.items || []).map((item: any) => ({
      id: item.videoId,
      snippet: {
        resourceId: { videoId: item.videoId },
        title: item.title,
        description: '',
        thumbnails: {
          default: { url: item.thumbnail },
          medium: { url: item.thumbnail },
          high: { url: item.thumbnail },
        },
        position: item.position,
        publishedAt: item.addedAt,
      },
      contentDetails: {
        videoId: item.videoId,
      },
    }))

    const exportData = {
      id: playlist?.playlistId || cached?.playlistId || req.params.id,
      snippet: {
        title: playlist?.title || cached?.title || '',
        description: playlist?.description || cached?.description || '',
        thumbnails: {
          default: { url: playlist?.thumbnail || cached?.thumbnailUrl },
          medium: { url: playlist?.thumbnail || cached?.thumbnailUrl },
          high: { url: playlist?.thumbnail || cached?.thumbnailUrl },
        },
        channelId: cached?.channelId,
        channelTitle: cached?.channelTitle,
      },
      contentDetails: {
        itemCount: playlist?.itemCount || cached?.itemCount || items.length,
      },
      items,
      exportedAt: new Date().toISOString(),
      source: 'mongo',
    }

    res.json(exportData)
  } catch (error) {
    res.status(500).json({ error: 'Failed to export playlist' })
  }
})

export default router
