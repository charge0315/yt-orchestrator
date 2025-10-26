/**
 * YouTube Music 互換ルーター
 * - YouTube Data API v3 を使用して音楽系プレイリストを提供
 * - MongoDB キャッシュ優先（必要時のみ API 取得）
 * - 日次制限（1日1回）に対応: 強制取得時のみ当日枠を消費
 */
import express, { Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { YouTubeApiService } from '../services/youtubeApi.js'
import { CachedPlaylist } from '../models/CachedPlaylist.js'
import mongoose from 'mongoose'
import { acquireYouTubeDaily } from '../utils/dailyGate.js'

const router = express.Router()

/**
 * GET /api/ytmusic/auth/status
 * 接続状態を返却（YouTube Data API を利用中のため常に接続済み）
 */
router.get('/auth/status', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ connected: true, message: 'YouTube Data API v3 を利用中のため、常に接続済みです' })
  } catch (error) {
    console.error('Error checking YouTube Music status:', error)
    res.status(500).json({ error: 'Failed to check YouTube Music status' })
  }
})

/**
 * GET /api/ytmusic/playlists
 * 音楽プレイリスト一覧を返却（キャッシュ優先）
 * クエリ: force=1|refresh=1 で強制取得（当日枠が必要）
 */
router.get('/playlists', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const force = (req.query.force as string | undefined) === '1' || (req.query.refresh as string | undefined) === '1'

    if (force && (await acquireYouTubeDaily(req.userId))) {
      try {
        const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
        const result = await yt.getPlaylists()
        const musicOnly = (result.items || []).filter((pl: any) => yt.isMusicPlaylist(pl))

        // キャッシュ更新（次回通常アクセスで反映）
        try {
          if (mongoose.connection.readyState === 1 && musicOnly.length > 0) {
            const bulkOps = musicOnly.map((pl: any) => ({
              updateOne: {
                filter: { userId: req.userId, playlistId: pl.id },
                update: {
                  title: pl.snippet?.title,
                  description: pl.snippet?.description,
                  thumbnailUrl:
                    pl.snippet?.thumbnails?.high?.url ||
                    pl.snippet?.thumbnails?.medium?.url ||
                    pl.snippet?.thumbnails?.default?.url,
                  itemCount: pl.contentDetails?.itemCount,
                  channelId: pl.snippet?.channelId,
                  channelTitle: pl.snippet?.channelTitle,
                  privacy: pl.status?.privacyStatus,
                  isMusicPlaylist: true,
                  etag: pl.etag,
                  cachedAt: new Date(),
                },
                upsert: true,
              },
            }))
            await CachedPlaylist.bulkWrite(bulkOps)
          }
        } catch {}

        return res.json({ items: musicOnly, nextPageToken: result.nextPageToken })
      } catch (e) {
        console.error('Force fetch YT Music playlists failed:', e)
        return res.json({ items: [], nextPageToken: undefined })
      }
    }

    // キャッシュ優先で返却
    if (mongoose.connection.readyState === 1) {
      const cachedPlaylists = await CachedPlaylist.find({ userId: req.userId, isMusicPlaylist: true })
      if (cachedPlaylists.length > 0) {
        const oldestCache = cachedPlaylists.reduce((oldest, current) => (current.cachedAt < oldest.cachedAt ? current : oldest))
        const cacheAge = Date.now() - oldestCache.cachedAt.getTime()
        const cacheAgeMinutes = Math.round(cacheAge / 1000 / 60)
        const cacheAgeHours = Math.round(cacheAge / 1000 / 60 / 60)
        const ageDisplay = cacheAgeHours >= 1 ? `${cacheAgeHours}h old` : `${cacheAgeMinutes}min old`
        console.log(`📀 Returning ${cachedPlaylists.length} YouTube Music playlists from MongoDB cache (${ageDisplay})`)

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
        }))

        return res.json({ items: formatted, nextPageToken: undefined })
      }
    }

    console.log('⚠️ MongoDB not connected or no cache for music playlists')
    res.json({ items: [], nextPageToken: undefined })
  } catch (error) {
    console.error('Error fetching YouTube Music playlists:', error)
    res.json({ items: [], nextPageToken: undefined })
  }
})

/**
 * GET /api/ytmusic/playlists/:id
 * プレイリスト詳細を返却（変換してフロントの想定構造に合わせる）
 */
router.get('/playlists/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const playlist = await yt.getPlaylist(req.params.id)
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' })

    const itemsResult = await yt.getPlaylistItems(req.params.id)
    const transformed = {
      _id: playlist.id,
      name: playlist.snippet?.title || '',
      description: playlist.snippet?.description || '',
      thumbnail: playlist.snippet?.thumbnails?.default?.url,
      songs: (itemsResult.items || []).map((item: any) => ({
        videoId: item.snippet?.resourceId?.videoId,
        title: item.snippet?.title,
        artist: item.snippet?.videoOwnerChannelTitle || 'Unknown Artist',
        thumbnail: item.snippet?.thumbnails?.default?.url,
        addedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : undefined,
      })),
      createdAt: playlist.snippet?.publishedAt ? new Date(playlist.snippet.publishedAt) : new Date(),
      updatedAt: new Date(),
    }
    res.json(transformed)
  } catch (error) {
    console.error('Error fetching YouTube Music playlist:', error)
    res.status(500).json({ error: 'Failed to fetch YouTube Music playlist' })
  }
})

/**
 * GET /api/ytmusic/search
 * 楽曲（動画）検索を実行
 */
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Search query is required' })

    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const results = await yt.searchVideos(query, 20)
    const transformed = results.map((video: any) => ({
      videoId: video.id?.videoId,
      title: video.snippet?.title,
      artist: video.snippet?.channelTitle || 'Unknown Artist',
      thumbnail: video.snippet?.thumbnails?.default?.url,
    }))
    res.json(transformed)
  } catch (error) {
    console.error('Error searching YouTube Music:', error)
    res.status(500).json({ error: 'Failed to search YouTube Music' })
  }
})

export default router

