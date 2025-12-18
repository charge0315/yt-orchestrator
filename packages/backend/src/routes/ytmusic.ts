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
    console.error('YouTube Music 状態確認エラー:', error)
    res.status(500).json({ error: 'YouTube Music の状態確認に失敗しました' })
  }
})

/**
 * GET /api/ytmusic/playlists
 * 音楽プレイリスト一覧を返却（キャッシュ優先）
 * クエリ: force=1|refresh=1 で強制取得（当日枠が必要）
 */
router.get('/playlists', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // MongoDBキャッシュのみで返却
    if (mongoose.connection.readyState === 1) {
      const cachedPlaylists = await CachedPlaylist.find({ userId: req.userId, isMusicPlaylist: true })
      if (cachedPlaylists.length > 0) {
        const oldestCache = cachedPlaylists.reduce((oldest, current) => (current.cachedAt < oldest.cachedAt ? current : oldest))
        const cacheAge = Date.now() - oldestCache.cachedAt.getTime()
        const cacheAgeMinutes = Math.round(cacheAge / 1000 / 60)
        const cacheAgeHours = Math.round(cacheAge / 1000 / 60 / 60)
        const ageDisplay = cacheAgeHours >= 1 ? `${cacheAgeHours}時間前` : `${cacheAgeMinutes}分前`
        console.log(`📀 MongoDB キャッシュから YouTube Music プレイリストを返却します: ${cachedPlaylists.length} 件（${ageDisplay}）`)

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

    console.log('⚠️ MongoDB 未接続、または音楽プレイリストのキャッシュがありません')
    res.json({ items: [], nextPageToken: undefined })
  } catch (error) {
    console.error('YouTube Music プレイリスト取得エラー:', error)
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
    if (!playlist) return res.status(404).json({ error: 'プレイリストが見つかりません' })

    const itemsResult = await yt.getPlaylistItems(req.params.id)
    const transformed = {
      _id: playlist.id,
      name: playlist.snippet?.title || '',
      description: playlist.snippet?.description || '',
      thumbnail: playlist.snippet?.thumbnails?.default?.url,
      songs: (itemsResult.items || []).map((item: any) => ({
        videoId: item.snippet?.resourceId?.videoId,
        title: item.snippet?.title,
        artist: item.snippet?.videoOwnerChannelTitle || '不明なアーティスト',
        thumbnail: item.snippet?.thumbnails?.default?.url,
        addedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : undefined,
      })),
      createdAt: playlist.snippet?.publishedAt ? new Date(playlist.snippet.publishedAt) : new Date(),
      updatedAt: new Date(),
    }
    res.json(transformed)
  } catch (error) {
    console.error('YouTube Music プレイリスト詳細取得エラー:', error)
    res.status(500).json({ error: 'YouTube Music プレイリストの取得に失敗しました' })
  }
})

/**
 * GET /api/ytmusic/search
 * 楽曲（動画）検索を実行
 */
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query
    if (!query || typeof query !== 'string') return res.status(400).json({ error: '検索クエリが必要です' })

    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const results = await yt.searchVideos(query, 20)
    const transformed = results.map((video: any) => ({
      videoId: video.id?.videoId,
      title: video.snippet?.title,
      artist: video.snippet?.channelTitle || '不明なアーティスト',
      thumbnail: video.snippet?.thumbnails?.default?.url,
    }))
    res.json(transformed)
  } catch (error) {
    console.error('YouTube Music 検索エラー:', error)
    res.status(500).json({ error: 'YouTube Music の検索に失敗しました' })
  }
})

export default router
