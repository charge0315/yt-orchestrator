/**
 * AI おすすめルーター
 * OpenAI を使用して登録チャンネルに基づくおすすめを生成（クォータ節約のため基本はキャッシュ使用）
 */
import express, { Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { CachedChannel } from '../models/CachedChannel.js'
import OpenAI from 'openai'

const router = express.Router()

// OpenAI API キーが設定されている場合のみクライアント初期化
const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'DUMMY_OPENAI_API_KEY'
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

// すべてのルートで認証を必須にする
router.use(authenticate)

/**
 * GET /api/recommendations
 * AI によるおすすめチャンネル・アーティストを返却
 * MongoDB キャッシュを使用して YouTube API クォータを節約
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'ユーザーが認証されていません' })

    // MongoDB キャッシュから登録チャンネル情報を取得（YouTube API 不使用）
    const cachedChannels = await CachedChannel.find({ userId }).sort({ cachedAt: -1 }).limit(200).lean()
    console.log(`ユーザー ${userId} のキャッシュ済みチャンネル: ${cachedChannels.length} 件`)

    if (!cachedChannels || cachedChannels.length === 0) {
      return res.json([])
    }

    const subscribedNames = new Set(
      cachedChannels
        .map((ch: any) => (ch.channelTitle || '').toString().trim())
        .filter((s: string) => s.length > 0)
        .map((s: string) => s.toLowerCase())
    )

    const getText = (ch: any) => `${ch.channelTitle || ''} ${ch.channelDescription || ''}`.toLowerCase()

    // 簡易カテゴリ推定（クォータ消費ゼロ）
    const scores: Record<string, number> = {
      music: 0,
      tech: 0,
      gaming: 0,
      cooking: 0,
      science: 0,
      programming: 0,
      fitness: 0,
      vlogs: 0,
    }

    for (const ch of cachedChannels as any[]) {
      const text = getText(ch)
      if (ch.isArtist === true) scores.music += 2
      if (/\b(topic|vevo|music|album|mv|live)\b|音楽|公式|歌|作業用/.test(text)) scores.music += 1
      if (/\b(tech|gadget|review|iphone|android|pc|laptop)\b|ガジェット|テック|レビュー/.test(text)) scores.tech += 1
      if (/\b(game|gaming|switch|ps\d|xbox|実況)\b|ゲーム|実況/.test(text)) scores.gaming += 1
      if (/\b(recipe|cooking|kitchen)\b|料理|レシピ/.test(text)) scores.cooking += 1
      if (/\b(science|math|physics|chemistry|education)\b|科学|教育|解説/.test(text)) scores.science += 1
      if (/\b(programming|developer|javascript|typescript|python|coding)\b|プログラミング|開発|エンジニア/.test(text)) scores.programming += 1
      if (/\b(workout|fitness|gym|yoga)\b|筋トレ|フィットネス|ヨガ/.test(text)) scores.fitness += 1
      if (/\b(vlog|daily|life)\b|日常|ルーティン|vlog/.test(text)) scores.vlogs += 1
    }

    const ranked = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .filter(([, v]) => v > 0)
      .map(([k]) => k)

    const categoryToQueries: Record<string, Array<{ title: string; query: string; reason: string }>> = {
      music: [
        { title: '作業用BGMを新規開拓', query: 'lofi hip hop live', reason: '音楽系の登録チャンネルが多い' },
        { title: '新譜/リリース情報', query: '新曲 プレイリスト 2025', reason: '最新の音楽トレンドを追いやすい' },
        { title: 'ライブ/セッション', query: 'live session music', reason: 'ライブ系のおすすめを探索' },
      ],
      tech: [
        { title: '最新ガジェットの比較', query: '2025 smartphone comparison', reason: 'テック系チャンネルの傾向' },
        { title: '開封・レビュー', query: 'laptop review 2025', reason: 'レビュー系が好きそう' },
      ],
      gaming: [
        { title: '実況の新規チャンネル', query: 'ゲーム 実況 おすすめ', reason: 'ゲーム系の登録傾向' },
        { title: '最新ゲームトレンド', query: 'new game releases 2025', reason: '新作情報を拾う' },
      ],
      cooking: [
        { title: '時短レシピ', query: '時短 レシピ 簡単', reason: '料理系の登録傾向' },
        { title: '作り置き', query: '作り置き 1週間', reason: '日常に役立つ料理コンテンツ' },
      ],
      science: [
        { title: '科学解説の深掘り', query: 'science explained', reason: '解説・教育系が好きそう' },
        { title: '身近な数学', query: 'math explained', reason: '理解が進む系の動画を探索' },
      ],
      programming: [
        { title: '実務寄りのTypeScript', query: 'TypeScript best practices', reason: '開発系チャンネルの傾向' },
        { title: '最新フロントエンド', query: 'React patterns 2025', reason: '技術トレンドを拾う' },
      ],
      fitness: [
        { title: '自宅ワークアウト', query: 'home workout 20 minutes', reason: 'フィットネス系の傾向' },
        { title: 'ストレッチ/回復', query: 'stretch routine', reason: '継続しやすい内容を探索' },
      ],
      vlogs: [
        { title: '朝ルーティン', query: 'morning routine vlog', reason: '日常系の傾向' },
        { title: '作業/勉強Vlog', query: 'study with me', reason: '落ち着く系コンテンツを探索' },
      ],
    }

    const fallback: any[] = []
    const pickedQueries = new Set<string>()

    const orderedCategories = ranked.length > 0 ? ranked : ['music', 'tech', 'science', 'gaming']
    for (const cat of orderedCategories) {
      for (const q of categoryToQueries[cat] || []) {
        if (fallback.length >= 5) break
        const key = q.query.toLowerCase()
        if (pickedQueries.has(key)) continue
        if (subscribedNames.has(key)) continue
        pickedQueries.add(key)
        fallback.push({
          title: q.title,
          channelTitle: q.query,
          reason: q.reason,
        })
      }
      if (fallback.length >= 5) break
    }

    // OpenAI が使えるなら、より「登録チャンネルに寄せた」推薦語を生成（失敗時はfallback）
    if (openai && cachedChannels.length >= 3) {
      try {
        const channelHints = cachedChannels
          .slice(0, 40)
          .map((ch: any) => ({ title: ch.channelTitle, isArtist: ch.isArtist === true }))

        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
        const prompt = {
          role: 'user' as const,
          content: [
            'あなたはYouTubeのおすすめ生成アシスタントです。',
            '次の登録チャンネル（抜粋）を参考に、未登録の可能性が高い「検索キーワード/チャンネル名」を5件提案してください。',
            '出力は必ずJSON配列のみ。各要素は {"title": string, "channelTitle": string, "reason": string }。',
            'channelTitle は YouTube 検索に使う文字列にしてください（固有名 or キーワード）。',
            'すでに登録済みっぽい名前は避けてください。',
            '',
            JSON.stringify(channelHints),
          ].join('\n'),
        }

        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: '必ず有効なJSON配列のみを返し、余計な文章は出力しない。',
            },
            prompt,
          ],
          temperature: 0.7,
        })

        const content = completion.choices?.[0]?.message?.content || ''
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed
            .filter((x) => x && typeof x === 'object')
            .map((x) => ({
              title: String(x.title || ''),
              channelTitle: String(x.channelTitle || ''),
              reason: String(x.reason || ''),
            }))
            .filter((x) => x.title && x.channelTitle)
            .filter((x) => !subscribedNames.has(x.channelTitle.toLowerCase()))
            .slice(0, 5)

          if (cleaned.length > 0) {
            console.log(`おすすめを返却します: ${cleaned.length} 件（OpenAI）`)
            return res.json(cleaned)
          }
        }
      } catch (e) {
        console.warn('OpenAIおすすめ生成に失敗したため、フォールバックを返します:', e)
      }
    }

    console.log(`おすすめを返却します: ${fallback.length} 件（クォータ消費なし/フォールバック）`)
    return res.json(fallback.slice(0, 5))
  } catch (error) {
    console.error('おすすめ取得エラー:', error)
    res.status(500).json({ error: 'おすすめの取得に失敗しました' })
  }
})

export default router

