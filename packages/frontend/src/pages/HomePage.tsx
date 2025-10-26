/**
 * ホームページコンポーネント
 * YouTube Orchestratorのメイン画面
 * - 最新動画の横スクロール表示
 * - YouTubeチャンネル・プレイリスト
 * - YouTube Musicアーティスト・プレイリスト
 * - AIおすすめセクション
 */
import { useState, useEffect } from 'react'
import { channelsApi, playlistsApi, artistsApi, ytmusicApi, youtubeDataApi, recommendationsApi } from '../api/client'
import SkeletonLoader from '../components/SkeletonLoader'
import VideoPlayer from '../components/VideoPlayer'
import './HomePage.css'

function HomePage() {
  // 各種データの状態管理
  const [channels, setChannels] = useState<any[]>([]) // YouTubeチャンネル
  const [playlists, setPlaylists] = useState<any[]>([]) // YouTube再生リスト
  const [artists, setArtists] = useState<any[]>([]) // YouTube Musicアーティスト
  const [ytmPlaylists, setYtmPlaylists] = useState<any[]>([]) // YouTube Musicプレイリスト

  // 最新動画タイトルのマップ（チャンネルID/プレイリストID → 最新動画タイトル）
  const [latestVideoTitles, setLatestVideoTitles] = useState<Record<string, string>>({})

  // ソート設定
  const [channelSort, setChannelSort] = useState<'recent' | 'name'>('recent')
  const [playlistSort, setPlaylistSort] = useState<'recent' | 'name'>('recent')
  const [artistSort, setArtistSort] = useState<'recent' | 'name'>('recent')
  const [ytmPlaylistSort, setYtmPlaylistSort] = useState<'recent' | 'name'>('recent')

  // 最新動画とおすすめ
  const [latestVideos, setLatestVideos] = useState<any[]>([])
  const [loadingLatest, setLoadingLatest] = useState(true)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loadingRecs, setLoadingRecs] = useState(true)

  // 認証状態
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 動画プレイヤー
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)
  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(null)

  // 初回レンダリング時にデータをロード
  useEffect(() => {
    loadData()
  }, [])

  /**
   * すべてのデータをロードする
   */
  const loadData = async () => {
    try {
      // チャンネル、プレイリスト、アーティストを並行して取得
      const [channelsRes, playlistsRes, artistsRes] = await Promise.all([
        channelsApi.getAll().catch((err) => {
          // 認証エラーの場合は未認証状態に設定
          if (err.response?.status === 401 || err.response?.status === 500) setIsAuthenticated(false)
          return { data: [] }
        }),
        playlistsApi.getAll().catch(() => ({ data: [] })),
        artistsApi.getAll().catch(() => ({ data: [] }))
      ])

      // データが1つでも存在すれば認証済みと判定
      if (channelsRes.data?.length > 0 || playlistsRes.data?.length > 0 || artistsRes.data?.length > 0) {
        setIsAuthenticated(true)
      }

      setChannels(Array.isArray(channelsRes.data) ? channelsRes.data : [])
      // YouTube APIレスポンスの形式を処理（{ items: [...], nextPageToken } または [...] の両方に対応）
      const playlistData = (playlistsRes.data as any)?.items ?? playlistsRes.data
      setPlaylists(Array.isArray(playlistData) ? playlistData : [])
      setArtists(Array.isArray(artistsRes.data) ? artistsRes.data : [])

      // YouTube Musicプレイリストを取得
      try {
        const ytmRes = await ytmusicApi.getPlaylists()
        // YouTube APIレスポンスの形式を処理（{ items: [...], nextPageToken } または [...] の両方に対応）
        const ytmData = (ytmRes.data as any)?.items ?? ytmRes.data
        setYtmPlaylists(Array.isArray(ytmData) ? ytmData : [])
        console.log('YouTube Music playlists loaded:', ytmData?.length || 0)
      } catch (error) {
        console.error('Failed to load YouTube Music playlists:', error)
        setYtmPlaylists([])
      }

      // 最新動画とおすすめを読み込み
      const channels = Array.isArray(channelsRes.data) ? channelsRes.data : []
      const artists = Array.isArray(artistsRes.data) ? artistsRes.data : []
      await loadLatestVideos([...channels, ...artists])
      await loadRecommendations()
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  /**
   * AIおすすめを読み込む
   */
  const loadRecommendations = async () => {
    try {
      const response = await recommendationsApi.get()
      setRecommendations(response.data || [])
    } catch (error) {
      console.log('Recommendations error:', error)
      setRecommendations([])
    } finally {
      setLoadingRecs(false)
    }
  }

  /**
   * 登録チャンネルの最新動画を読み込む（上位10件）
   * 同時に各チャンネルの最新動画タイトルも取得
   */
  const loadLatestVideos = async (allChannels: any[]) => {
    try {
      const response = await artistsApi.getNewReleases()
      const videos = (response.data || []).slice(0, 10).map((video: any) => ({
        videoId: video.id?.videoId || video.videoId,
        title: video.snippet?.title || video.title,
        thumbnail: video.snippet?.thumbnails?.medium?.url || video.thumbnail,
        channelName: video.snippet?.channelTitle || video.channelTitle,
        channelId: video.snippet?.channelId
      }))
      setLatestVideos(videos)

      // チャンネルごとの最新動画タイトルマップを作成
      // バックエンドから直接取得したlatestVideoTitleを優先
      const titleMap: Record<string, string> = {}
      allChannels.forEach((channel: any) => {
        const channelId = channel.snippet?.resourceId?.channelId || channel.id
        if (channelId && channel.latestVideoTitle) {
          titleMap[channelId] = channel.latestVideoTitle
        }
      })

      // 新リリースAPIからの動画タイトルで補完（バックエンドにない場合）
      videos.forEach((video: any) => {
        if (video.channelId && !titleMap[video.channelId]) {
          titleMap[video.channelId] = video.title
        }
      })
      setLatestVideoTitles(titleMap)
    } catch (error) {
      console.log('Latest videos error:', error)
      setLatestVideos([])
    } finally {
      setLoadingLatest(false)
    }
  }

  /**
   * チャンネルが7日以内に更新されたかをチェック
   */
  const hasRecentUpdate = (channel: any) => {
    const publishedAt = channel.snippet?.publishedAt || channel.contentDetails?.relatedPlaylists?.uploads
    if (!publishedAt) return false
    const daysSinceUpdate = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceUpdate <= 7
  }

  /**
   * チャンネルをクリックした時の処理
   * キャッシュされた最新動画をプレイヤーで再生（APIクォータ節約）
   */
  const handleChannelClick = async (channel: any) => {
    try {
      // まずキャッシュされた最新動画IDを使用
      const videoId = channel.latestVideoId

      if (videoId) {
        playVideo(videoId)
        return
      }

      // キャッシュになければAPI呼び出し（クォータ超過時は失敗する可能性あり）
      const channelId = channel.snippet?.resourceId?.channelId || channel.id
      const response = await youtubeDataApi.searchVideos(`channel:${channelId}`, 1)
      if (response.data.length > 0) {
        const video = response.data[0]
        const fallbackVideoId = video.id?.videoId || video.videoId
        if (fallbackVideoId) {
          playVideo(fallbackVideoId)
        }
      }
    } catch (error) {
      console.error('Failed to get latest video:', error)
    }
  }

  /**
   * アイテムをソート
   * @param items ソート対象のアイテム配列
   * @param sortType ソートタイプ（'recent': 登録順、'name': 名前順）
   */
  const sortItems = (items: any[], sortType: 'recent' | 'name') => {
    // 配列でない場合は空配列を返す
    if (!Array.isArray(items)) {
      return []
    }
    const sorted = [...items]
    if (sortType === 'name') {
      sorted.sort((a, b) => {
        const nameA = a.snippet?.title || a.name || ''
        const nameB = b.snippet?.title || b.name || ''
        return nameA.localeCompare(nameB)
      })
    }
    return sorted
  }

  /**
   * 動画をプレイヤーで再生
   */
  const playVideo = (videoId: string) => {
    console.log('▶️ Playing video:', videoId)
    setPlayingVideoId(videoId)
    setPlayingPlaylistId(null) // プレイリストをクリア
  }

  /**
   * プレイリストをプレイヤーで再生
   */
  const playPlaylist = (playlistId: string) => {
    console.log('▶️ Playing playlist:', playlistId)
    setPlayingPlaylistId(playlistId)
    setPlayingVideoId(null) // 単一動画IDをクリア
  }

  /**
   * 動画プレイヤーを閉じる
   */
  const closePlayer = () => {
    setPlayingVideoId(null)
    setPlayingPlaylistId(null)
  }

  return (
    <div className="home-page">
      <h1>YouTube Orchestrator</h1>

      {/* 動画プレイヤー */}
      <VideoPlayer
        videoId={playingVideoId}
        playlistId={playingPlaylistId}
        onClose={closePlayer}
      />
      
      <section className="latest-section" style={{ marginBottom: '32px', backgroundColor: '#1a1a1a', padding: '24px', borderRadius: '12px', border: '1px solid #2a2a2a' }}>
        <h2>🆕 最新情報</h2>
        {loadingLatest ? (
          <SkeletonLoader type="video" count={5} />
        ) : latestVideos.length > 0 ? (
          <div className="items-scroll">
            {latestVideos.map((video: any, idx: number) => (
              <div key={idx} style={{ minWidth: '210px', width: '210px', flexShrink: 0, backgroundColor: '#2a2a2a', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => playVideo(video.videoId)}>
                {video.thumbnail && (
                  <img src={video.thumbnail} alt={video.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                )}
                <div style={{ padding: '12px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{video.title}</h4>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: '#aaaaaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.channelName}</p>
                </div>
              </div>
            ))}
          </div>
        ) : !isAuthenticated ? (
          <p style={{ color: '#666' }}>ログインすると最新動画が表示されます</p>
        ) : (
          <p style={{ color: '#666' }}>登録チャンネルがありません</p>
        )}
      </section>

      <section className="category-section">
        <h2>▶️ YouTube</h2>
        
        <div className="subsection">
          <div className="subsection-header">
            <h3>登録チャンネル</h3>
            <select value={channelSort} onChange={(e) => setChannelSort(e.target.value as any)}>
              <option value="recent">登録順</option>
              <option value="name">名前順</option>
            </select>
          </div>
          <div className="items-scroll">
            {sortItems(channels, channelSort).map((ch: any) => {
              const channelId = ch.snippet?.resourceId?.channelId || ch.id
              const latestTitle = latestVideoTitles[channelId]
              return (
                <div key={ch.id} className="item-card" onClick={() => handleChannelClick(ch)}>
                  {hasRecentUpdate(ch) && <span className="new-badge">NEW</span>}
                  {/* 最新動画のサムネイルを優先的に表示、なければチャンネルのサムネイル */}
                  {(ch.latestVideoThumbnail || ch.snippet?.thumbnails?.default?.url) && (
                    <img
                      src={ch.latestVideoThumbnail || ch.snippet.thumbnails.default.url}
                      alt={ch.snippet.title}
                    />
                  )}
                  <div className="card-content">
                    {latestTitle && <h4>{latestTitle}</h4>}
                    <p>{ch.snippet?.title}</p>
                  </div>
                </div>
              )
            })}
            {channels.length === 0 && <p className="empty">{!isAuthenticated ? 'ログインしてください' : '登録チャンネルがありません'}</p>}
          </div>
        </div>

        <div className="subsection">
          <div className="subsection-header">
            <h3>再生リスト</h3>
            <select value={playlistSort} onChange={(e) => setPlaylistSort(e.target.value as any)}>
              <option value="recent">更新順</option>
              <option value="name">名前順</option>
            </select>
          </div>
          <div className="items-scroll">
            {sortItems(playlists, playlistSort).map((pl: any) => (
              <div key={pl.id || pl._id} className="item-card" onClick={() => {
                if (pl.id) {
                  playPlaylist(pl.id)
                } else {
                  console.error('❌ No id in playlist:', pl)
                }
              }}>
                {pl.snippet?.thumbnails?.default?.url && (
                  <img src={pl.snippet.thumbnails.default.url} alt={pl.snippet.title || pl.name} />
                )}
                <div className="card-content">
                  <h4>{pl.snippet?.title || pl.name}</h4>
                  <p>プレイリスト</p>
                </div>
              </div>
            ))}
            {playlists.length === 0 && <p className="empty">{!isAuthenticated ? 'ログインしてください' : '再生リストがありません'}</p>}
          </div>
        </div>
      </section>

      <section className="category-section">
        <h2>🎵 YouTube Music</h2>
        
        <div className="subsection">
          <div className="subsection-header">
            <h3>アーティスト</h3>
            <select value={artistSort} onChange={(e) => setArtistSort(e.target.value as any)}>
              <option value="recent">登録順</option>
              <option value="name">名前順</option>
            </select>
          </div>
          <div className="items-scroll">
            {sortItems(artists, artistSort).map((artist: any) => {
              const channelId = artist.snippet?.resourceId?.channelId || artist.id
              const latestTitle = latestVideoTitles[channelId]
              return (
                <div key={artist.id} className="item-card" onClick={() => handleChannelClick(artist)}>
                  {hasRecentUpdate(artist) && <span className="new-badge">NEW</span>}
                  {/* 最新動画のサムネイルを優先的に表示、なければチャンネルのサムネイル */}
                  {(artist.latestVideoThumbnail || artist.snippet?.thumbnails?.default?.url) && (
                    <img
                      src={artist.latestVideoThumbnail || artist.snippet.thumbnails.default.url}
                      alt={artist.snippet.title}
                    />
                  )}
                  <div className="card-content">
                    {latestTitle && <h4>{latestTitle}</h4>}
                    <p>{artist.snippet?.title}</p>
                  </div>
                </div>
              )
            })}
            {artists.length === 0 && <p className="empty">{!isAuthenticated ? 'ログインしてください' : '登録アーティストがありません'}</p>}
          </div>
        </div>

        <div className="subsection">
          <div className="subsection-header">
            <h3>プレイリスト</h3>
            <select value={ytmPlaylistSort} onChange={(e) => setYtmPlaylistSort(e.target.value as any)}>
              <option value="recent">更新順</option>
              <option value="name">名前順</option>
            </select>
          </div>
          <div className="items-scroll">
            {sortItems(ytmPlaylists, ytmPlaylistSort).map((pl: any) => (
              <div key={pl._id || pl.id} className="item-card" onClick={() => {
                if (pl.id) {
                  playPlaylist(pl.id)
                } else {
                  console.error('❌ No id in YouTube Music playlist:', pl)
                }
              }}>
                {(pl.snippet?.thumbnails?.default?.url || pl.thumbnail || pl.songs?.[0]?.thumbnail) && (
                  <img src={pl.snippet?.thumbnails?.default?.url || pl.thumbnail || pl.songs?.[0]?.thumbnail} alt={pl.snippet?.title || pl.name} />
                )}
                <div className="card-content">
                  <h4>{pl.snippet?.title || pl.name}</h4>
                  <p>プレイリスト</p>
                </div>
              </div>
            ))}
            {ytmPlaylists.length === 0 && <p className="empty">{!isAuthenticated ? 'ログインしてください' : 'プレイリストがありません'}</p>}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '32px', backgroundColor: '#1a1a1a', padding: '24px', borderRadius: '12px', border: '1px solid #2a2a2a' }}>
        <h2 style={{ fontSize: '28px', marginBottom: '24px', color: '#ff0000' }}>🤖 AIおすすめ</h2>
        {loadingRecs ? (
          <SkeletonLoader type="video" count={5} />
        ) : recommendations.length > 0 ? (
          <div className="items-scroll">
            {recommendations.map((rec: any, idx: number) => (
              <div
                key={idx}
                className="item-card"
                onClick={() => {
                  if (rec.videoId) {
                    playVideo(rec.videoId)
                  } else {
                    console.error('❌ No videoId in recommendation:', rec)
                  }
                }}
              >
                {/* サムネイル画像 */}
                {rec.thumbnail ? (
                  <img
                    src={rec.thumbnail}
                    alt={rec.title}
                  />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>
                    🤖
                  </div>
                )}
                <div className="card-content">
                  <h4>
                    {rec.title || rec.channelTitle}
                  </h4>
                  <p>
                    {rec.channelTitle}
                  </p>
                  <p style={{ fontSize: '16px', color: '#4caf50', marginTop: '4px' }}>
                    🎯 {rec.reason}
                  </p>
                  {rec.channelId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        artistsApi.subscribe({ channelId: rec.channelId })
                          .then(() => alert('チャンネルを登録しました'))
                          .catch((err) => console.error('Subscribe failed:', err))
                      }}
                      style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        backgroundColor: '#ff0000',
                        color: '#fff',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 600,
                        width: '100%'
                      }}
                    >
                      登録する
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : !isAuthenticated ? (
          <p style={{ color: '#666' }}>ログインするとAIおすすめが表示されます</p>
        ) : (
          <p style={{ color: '#666' }}>おすすめを生成するにはチャンネルを登録してください</p>
        )}
      </section>
    </div>
  )
}

export default HomePage
