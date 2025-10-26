/**
 * チャンネル ルーター
 * - YouTube Data API v3 の登録チャンネルを扱う（非アーティスト向け）
 * - MongoDB キャッシュ優先、必要時のみ API 取得
 * - 日次制限（1日1回）に対応
 */
import express, { Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { YouTubeApiService } from '../services/youtubeApi.js'
import { CachedChannel } from '../models/CachedChannel.js'
import mongoose from 'mongoose'
import { acquireYouTubeDaily } from '../utils/dailyGate.js'

const router = express.Router()

// すべてのルートで認証を必須にする
router.use(authenticate)

/**
 * DELETE /api/channels/cache
 * MongoDB キャッシュをクリア（開発用）
 */
router.delete('/cache', async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const result = await CachedChannel.deleteMany({ userId: req.userId })
      console.log(`🗑 Cleared ${result.deletedCount} channels from cache for user ${req.userId}`)
      res.json({ message: `Cleared ${result.deletedCount} channels from cache` })
    } else {
      res.status(503).json({ error: 'MongoDB not connected' })
    }
  } catch (error) {
    console.error('Error clearing channel cache:', error)
    res.status(500).json({ error: 'Failed to clear cache' })
  }
})

/**
 * GET /api/channels
 * 登録中のチャンネル一覧（非アーティスト）を返却
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24時間

    // 1. MongoDB からキャッシュを取得（非アーティストのみ）
    let cachedChannels: any[] = []
    if (mongoose.connection.readyState === 1) {
      cachedChannels = await CachedChannel.find({ userId: req.userId, isArtist: false })
      if (cachedChannels.length > 0) {
        // キャッシュが新しければそのまま返す。欠落項目は軽量補完
        const oldestCache = cachedChannels.reduce((oldest, current) => (current.cachedAt < oldest.cachedAt ? current : oldest))
        const cacheAge = Date.now() - oldestCache.cachedAt.getTime()
        if (cacheAge < CACHE_DURATION_MS) {
          let yt: YouTubeApiService | undefined
          const enriched = await Promise.all(
            cachedChannels.map(async (ch) => {
              if (ch.latestVideoId && ch.latestVideoTitle && ch.latestVideoThumbnail) return ch
              try {
                if (!yt) yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
                const vids = await yt.getChannelVideos(ch.channelId, 1)
                const latest = vids?.[0]
                if (latest) {
                  ch.latestVideoId = (latest as any).id?.videoId || (latest as any).id
                  ch.latestVideoTitle = latest.snippet?.title
                  ch.latestVideoThumbnail =
                    latest.snippet?.thumbnails?.high?.url ||
                    latest.snippet?.thumbnails?.medium?.url ||
                    latest.snippet?.thumbnails?.default?.url
                  ch.latestVideoPublishedAt = latest.snippet?.publishedAt ? new Date(latest.snippet.publishedAt) : ch.latestVideoPublishedAt
                  ch.cachedAt = new Date()
                  try {
                    await ch.save()
                  } catch {}
                }
              } catch {}
              return ch
            })
          )

          const formatted = enriched.map((ch) => ({
            kind: 'youtube#subscription',
            id: ch.subscriptionId,
            snippet: {
              resourceId: { channelId: ch.channelId },
              title: ch.channelTitle,
              description: ch.channelDescription,
              thumbnails: {
                default: { url: ch.thumbnailUrl },
                medium: { url: ch.thumbnailUrl },
                high: { url: ch.thumbnailUrl },
              },
            },
            latestVideoId: ch.latestVideoId,
            latestVideoThumbnail: ch.latestVideoThumbnail,
            latestVideoTitle: ch.latestVideoTitle,
          }))
          return res.json(formatted)
        }
      }
    }

    // 2. 日次制限チェック：当日枠が無ければキャッシュを返す、無ければ空
    {
      const allowed = await acquireYouTubeDaily(req.userId)
      if (!allowed) {
        if (cachedChannels.length > 0) {
          const formatted = cachedChannels.map((ch) => ({
            kind: 'youtube#subscription',
            id: ch.subscriptionId,
            snippet: {
              resourceId: { channelId: ch.channelId },
              title: ch.channelTitle,
              description: ch.channelDescription,
              thumbnails: {
                default: { url: ch.thumbnailUrl },
                medium: { url: ch.thumbnailUrl },
                high: { url: ch.thumbnailUrl },
              },
            },
            latestVideoId: ch.latestVideoId,
            latestVideoThumbnail: ch.latestVideoThumbnail,
            latestVideoTitle: ch.latestVideoTitle,
          }))
          return res.json(formatted)
        }
        return res.json([])
      }
    }

    // 3. YouTube API から全取得 → 非アーティストのみ抽出
    const yt = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken)
    const subs = await yt.getSubscriptions()
    const enriched = await Promise.all(
      subs.items.map(async (sub: any) => {
        const chId: string | undefined = sub.snippet?.resourceId?.channelId
        if (!chId) return null

        // アーティスト判定
        let isArtist = (sub.snippet?.title || '').toLowerCase().includes('- topic') || YouTubeApiService.isYouTubeMusicChannel(chId)
        if (!isArtist) {
          try {
            isArtist = await yt.isMusicChannelAsync(chId, 5)
          } catch {}
        }
        if (isArtist) return null

        try {
          const vids = await yt.getChannelVideos(chId, 1)
          const latest = vids?.[0]
          return {
            id: sub.id,
            snippet: sub.snippet,
            latestVideoId: (latest as any)?.id?.videoId || (latest as any)?.id,
            latestVideoThumbnail:
              latest?.snippet?.thumbnails?.high?.url || latest?.snippet?.thumbnails?.medium?.url || latest?.snippet?.thumbnails?.default?.url,
            latestVideoTitle: latest?.snippet?.title,
            latestVideoPublishedAt: latest?.snippet?.publishedAt ? new Date(latest.snippet.publishedAt) : undefined,
          }
        } catch {
          return { id: sub.id, snippet: sub.snippet }
        }
      })
    )

    const channels = enriched.filter(Boolean)

    // 4. MongoDB に保存（アップサート）
    if (mongoose.connection.readyState === 1 && channels.length > 0) {
      try {
        await CachedChannel.bulkWrite(
          channels.map((c: any) => ({
            updateOne: {
              filter: { userId: req.userId, channelId: c.snippet?.resourceId?.channelId },
              update: {
                channelTitle: c.snippet?.title,
                channelDescription: c.snippet?.description,
                thumbnailUrl:
                  c.snippet?.thumbnails?.high?.url || c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url,
                latestVideoId: c.latestVideoId,
                latestVideoThumbnail: c.latestVideoThumbnail,
                latestVideoTitle: c.latestVideoTitle,
                latestVideoPublishedAt: c.latestVideoPublishedAt,
                subscriptionId: c.id,
                isArtist: false,
                cachedAt: new Date(),
              },
              upsert: true,
            },
          }))
        )
      } catch {}
    }

    // 5. レスポンス
    const formatted = channels.map((c: any) => ({
      kind: 'youtube#subscription',
      id: c.id,
      snippet: c.snippet,
      latestVideoId: c.latestVideoId,
      latestVideoThumbnail: c.latestVideoThumbnail,
      latestVideoTitle: c.latestVideoTitle,
    }))
    return res.json(formatted)
  } catch (error) {
    console.error('Error fetching channels:', error)
    res.status(500).json({ error: 'Failed to fetch channels' })
  }
})

export default router

