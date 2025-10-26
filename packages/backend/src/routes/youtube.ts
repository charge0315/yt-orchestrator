/**
 * YouTube 動画プレイリスト・検索 ルーター
 * - 動画用プレイリスト（音楽以外）を返却
 * - 動画検索（キーワード）
 */
import express, { Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { YouTubeApiService } from '../services/youtubeApi.js'

const router = express.Router()

// 認証必須
router.use(authenticate)

/**
 * GET /api/youtube/playlists
 * YouTube 動画プレイリスト一覧を取得（音楽系を除外）
 * クエリ: pageToken (任意)
 */
router.get('/playlists', async (req: AuthRequest, res: Response) => {
  try {
    const { pageToken } = req.query
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const result = await yt.getPlaylists(pageToken as string | undefined)

    // 各プレイリストを非同期で音楽判定（並列）
    const playlistChecks = await Promise.all(
      result.items.map(async (playlist: any) => ({ playlist, isMusic: await yt.isMusicPlaylistAsync(playlist.id) }))
    )

    // 音楽プレイリストを除外（動画プレイリストのみ）
    const videoPlaylists = playlistChecks.filter(({ isMusic }) => !isMusic).map(({ playlist }) => playlist)

    res.json({ items: videoPlaylists, nextPageToken: result.nextPageToken })
  } catch (error) {
    console.error('Error fetching YouTube playlists:', error)
    res.json({ items: [], nextPageToken: undefined })
  }
})

/**
 * GET /api/youtube/search
 * 動画を検索
 * クエリ: query（必須）, maxResults（任意、既定10）
 */
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { query, maxResults } = req.query
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Query is required' })

    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const results = await yt.searchVideos(query, maxResults ? parseInt(maxResults as string) : 10)
    res.json(results)
  } catch (error) {
    console.error('Error searching videos:', error)
    res.json([])
  }
})

export default router

