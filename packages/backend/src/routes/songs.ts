/**
 * 曲検索ルーター
 * YouTube Data API v3 を使用して動画/曲を検索
 */
import express, { Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { YouTubeApiService } from '../services/youtubeApi.js'

const router = express.Router()

/**
 * GET /api/songs/search
 * キーワードで曲/動画を検索
 */
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query パラメータが必要です' })
    }

    // YouTube Data API v3 で検索
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const results = await yt.searchVideos(query, 25)

    // レスポンス形式を整形
    const transformed = results.map((video: any) => ({
      videoId: video.id?.videoId,
      title: video.snippet?.title,
      artist: video.snippet?.channelTitle || '不明なアーティスト',
      thumbnail: video.snippet?.thumbnails?.default?.url || video.snippet?.thumbnails?.medium?.url,
    }))

    res.json({ results: transformed })
  } catch (error) {
    console.error('曲/動画検索エラー:', error)
    res.status(500).json({ error: '曲/動画の検索に失敗しました' })
  }
})

export default router

