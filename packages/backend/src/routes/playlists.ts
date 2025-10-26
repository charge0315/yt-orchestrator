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
import mongoose from 'mongoose'
import { acquireYouTubeDaily } from '../utils/dailyGate.js'

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
 * プレイリスト一覧を返却（キャッシュ優先、必要時のみAPI）
 * クエリ: type=video|music|all, pageToken
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { pageToken } = req.query
    const type = (req.query.type as string | undefined)?.toLowerCase() as 'video' | 'music' | 'all' | undefined
    const desiredType: 'video' | 'music' | 'all' = type === 'music' || type === 'all' ? type : 'video'
    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000

    // ページネーションはAPI直呼び出し（当日枠が必要）
    if (pageToken) {
      const allowed = await acquireYouTubeDaily(req.userId)
      if (!allowed) return res.json({ items: [], nextPageToken: undefined })
      const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
      const result = await yt.getPlaylists(pageToken as string)
      const classified = result.items.map((pl: any) => ({ ...pl, isMusicPlaylist: yt.isMusicPlaylist(pl) }))
      const filtered = desiredType === 'all' ? classified : classified.filter((pl: any) => (desiredType === 'music' ? pl.isMusicPlaylist : !pl.isMusicPlaylist))
      return res.json({ items: filtered, nextPageToken: result.nextPageToken })
    }

    // 1) MongoDB キャッシュ
    let cachedPlaylists: any[] = []
    if (mongoose.connection.readyState === 1) {
      cachedPlaylists = await CachedPlaylist.find({ userId: req.userId })
      if (cachedPlaylists.length > 0) {
        const oldest = cachedPlaylists.reduce((a, b) => (a.cachedAt < b.cachedAt ? a : b))
        const cacheAge = Date.now() - oldest.cachedAt.getTime()
        if (cacheAge < CACHE_DURATION_MS) {
          const filteredCached = desiredType === 'all' ? cachedPlaylists : cachedPlaylists.filter((pl) => (desiredType === 'music' ? !!pl.isMusicPlaylist : !pl.isMusicPlaylist))
          const formatted = filteredCached.map((pl) => ({
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
          }))
          return res.json({ items: formatted, nextPageToken: undefined })
        }
      }
    }

    // 2) 日次制限（当日枠がなければキャッシュ返却 or 空）
    {
      const allowed = await acquireYouTubeDaily(req.userId)
      if (!allowed) {
        if (cachedPlaylists.length > 0) {
          const filteredCached = desiredType === 'all' ? cachedPlaylists : cachedPlaylists.filter((pl) => (desiredType === 'music' ? !!pl.isMusicPlaylist : !pl.isMusicPlaylist))
          const formatted = filteredCached.map((pl) => ({
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
          }))
          return res.json({ items: formatted, nextPageToken: undefined })
        }
        return res.json({ items: [], nextPageToken: undefined })
      }
    }

    // 3) YouTube API から取得（差分更新: ETag）
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    let playlistsWithType: any[] = []
    if (cachedPlaylists.length > 0) {
      console.log('🔄 Using ETag-based incremental update for playlists')
      const cachedEtag = cachedPlaylists[0]?.etag
      const result = await yt.getPlaylists(undefined, cachedEtag)
      playlistsWithType = (result.items || []).map((pl: any) => ({ ...pl, isMusicPlaylist: yt.isMusicPlaylist(pl) }))
    } else {
      console.log('📥 Using full fetch mode for playlists')
      const playlistsResult = await yt.getPlaylists()
      playlistsWithType = (playlistsResult.items || []).map((pl: any) => ({ ...pl, isMusicPlaylist: yt.isMusicPlaylist(pl) }))
    }

    // 4) MongoDB に保存
    if (mongoose.connection.readyState === 1 && playlistsWithType.length > 0) {
      try {
        const bulkOps = playlistsWithType.map((pl: any) => ({
          updateOne: {
            filter: { userId: req.userId, playlistId: pl.id },
            update: {
              title: pl.snippet?.title,
              description: pl.snippet?.description,
              thumbnailUrl:
                pl.snippet?.thumbnails?.high?.url || pl.snippet?.thumbnails?.medium?.url || pl.snippet?.thumbnails?.default?.url,
              itemCount: pl.contentDetails?.itemCount,
              channelId: pl.snippet?.channelId,
              channelTitle: pl.snippet?.channelTitle,
              privacy: pl.status?.privacyStatus,
              isMusicPlaylist: !!pl.isMusicPlaylist,
              etag: pl.etag,
              cachedAt: new Date(),
            },
            upsert: true,
          },
        }))
        await CachedPlaylist.bulkWrite(bulkOps)
        console.log(`✅ Saved ${playlistsWithType.length} playlists to MongoDB cache`)
      } catch (dbError) {
        console.error('Failed to save playlists to MongoDB:', dbError)
      }
    }

    const responseItems = desiredType === 'all' ? playlistsWithType : playlistsWithType.filter((pl: any) => (desiredType === 'music' ? pl.isMusicPlaylist : !pl.isMusicPlaylist))
    res.json({ items: responseItems, nextPageToken: undefined })
  } catch (error) {
    console.error('Error fetching playlists:', error)
    res.json({ items: [], nextPageToken: undefined })
  }
})

/**
 * GET /api/playlists/:id
 * プレイリスト詳細
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const playlist = await yt.getPlaylist(req.params.id)
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' })
    res.json(playlist)
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
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const playlist = await yt.getPlaylist(req.params.id)
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' })
    const itemsResult = await yt.getPlaylistItems(req.params.id)
    const exportData = {
      id: playlist.id,
      snippet: playlist.snippet,
      contentDetails: playlist.contentDetails,
      items: itemsResult.items,
      exportedAt: new Date().toISOString(),
    }
    res.json(exportData)
  } catch (error) {
    res.status(500).json({ error: 'Failed to export playlist' })
  }
})

export default router

