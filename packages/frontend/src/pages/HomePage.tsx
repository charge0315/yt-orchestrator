/**
 * ホームページコンポーネント
 * YouTube Orchestratorのメイン画面
 * - 最新動画の横スクロール表示
 * - YouTubeチャンネル・プレイリスト
 * - YouTube Musicアーティスト・プレイリスト
 * - AIおすすめセクション
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { channelsApi, playlistsApi, artistsApi, ytmusicApi, youtubeDataApi, recommendationsApi } from '../api/client'
import SkeletonLoader from '../components/SkeletonLoader'
import VideoPlayer from '../components/VideoPlayer'
import './HomePage.css'

function HomePage() {
  const navigate = useNavigate()

  // 各種データの状態管理
  const [channels, setChannels] = useState<any[]>([]) // YouTubeチャンネル
  const [playlists, setPlaylists] = useState<any[]>([]) // YouTube再生リスト
  const [artists, setArtists] = useState<any[]>([]) // YouTube Musicアーティスト
  const [ytmPlaylists, setYtmPlaylists] = useState<any[]>([]) // YouTube Musicプレイリスト

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
        playlistsApi.getAll().catch((err) => { return { data: [] } }),
        artistsApi.getAll().catch((err) => { return { data: [] } })
      ])

      // データが1つでも存在すれば認証済みと判定
      if (channelsRes.data?.length > 0 || playlistsRes.data?.length > 0 || artistsRes.data?.length > 0) {
        setIsAuthenticated(true)
      }

      setChannels(Array.isArray(channelsRes.data) ? channelsRes.data : [])
      // YouTube APIレスポンスの形式を処理（{ items: [...], nextPageToken } または [...] の両方に対応）
      const playlistData = playlistsRes.data?.items || playlistsRes.data
      setPlaylists(Array.isArray(playlistData) ? playlistData : [])
      setArtists(Array.isArray(artistsRes.data) ? artistsRes.data : [])

      // YouTube Musicプレイリストを取得
      try {
        const ytmRes = await ytmusicApi.getPlaylists()
        // YouTube APIレスポンスの形式を処理（{ items: [...], nextPageToken } または [...] の両方に対応）
        const ytmData = ytmRes.data?.items || ytmRes.data
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
   */
  const loadLatestVideos = async (allChannels: any[]) => {
    try {
      const response = await artistsApi.getNewReleases()
      const videos = (response.data || []).slice(0, 10).map((video: any) => ({
        videoId: video.id?.videoId || video.videoId,
        title: video.snippet?.title || video.title,
        thumbnail: video.snippet?.thumbnails?.medium?.url || video.thumbnail,
        channelName: video.snippet?.channelTitle || video.channelTitle
      }))
      setLatestVideos(videos)
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
   * チャンネルの最新動画をモーダルで再生
   */
  const handleChannelClick = async (channel: any) => {
    try {
      const channelId = channel.snippet?.resourceId?.channelId || channel.id
      const response = await youtubeDataApi.searchVideos(`channel:${channelId}`, 1)
      if (response.data.length > 0) {
        const videoId = response.data[0].id?.videoId || response.data[0].videoId
        if (videoId) {
          playVideo(videoId)
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
   * 動画をモーダルで再生
   */
  const playVideo = (videoId: string) => {
    setPlayingVideoId(videoId)
  }

  /**
   * 動画プレイヤーを閉じる
   */
  const closePlayer = () => {
    setPlayingVideoId(null)
  }

  return (
    <div className="home-page">
      <h1>YouTube Orchestrator</h1>

      {/* 動画プレイヤーモーダル */}
      <VideoPlayer videoId={playingVideoId} onClose={closePlayer} />
      
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
                  <p style={{ fontSize: '12px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.channelName}</p>
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
            {sortItems(channels, channelSort).map((ch: any) => (
              <div key={ch.id} className="item-card" onClick={() => handleChannelClick(ch)}>
                {hasRecentUpdate(ch) && <span className="new-badge">NEW</span>}
                {/* 最新動画のサムネイルを優先的に表示、なければチャンネルのサムネイル */}
                {(ch.latestVideoThumbnail || ch.snippet?.thumbnails?.default?.url) && (
                  <img
                    src={ch.latestVideoThumbnail || ch.snippet.thumbnails.default.url}
                    alt={ch.snippet.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                <p>{ch.snippet?.title}</p>
              </div>
            ))}
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
              <div key={pl.id || pl._id} className="item-card" onClick={() => navigate('/playlists')}>
                {pl.snippet?.thumbnails?.default?.url && (
                  <img src={pl.snippet.thumbnails.default.url} alt={pl.snippet.title || pl.name} />
                )}
                <p>{pl.snippet?.title || pl.name}</p>
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
            {sortItems(artists, artistSort).map((artist: any) => (
              <div key={artist.id} className="item-card" onClick={() => handleChannelClick(artist)}>
                {hasRecentUpdate(artist) && <span className="new-badge">NEW</span>}
                {/* 最新動画のサムネイルを優先的に表示、なければチャンネルのサムネイル */}
                {(artist.latestVideoThumbnail || artist.snippet?.thumbnails?.default?.url) && (
                  <img
                    src={artist.latestVideoThumbnail || artist.snippet.thumbnails.default.url}
                    alt={artist.snippet.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                <p>{artist.snippet?.title}</p>
              </div>
            ))}
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
              <div key={pl._id || pl.id} className="item-card" onClick={() => navigate('/playlists')}>
                {(pl.thumbnail || pl.songs?.[0]?.thumbnail) && (
                  <img src={pl.thumbnail || pl.songs[0].thumbnail} alt={pl.name} />
                )}
                <p>{pl.name}</p>
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
                style={{ minWidth: '210px', width: '210px', flexShrink: 0, backgroundColor: '#2a2a2a', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => rec.videoId && playVideo(rec.videoId)}
              >
                {/* サムネイル画像 */}
                {rec.thumbnail ? (
                  <img
                    src={rec.thumbnail}
                    alt={rec.title}
                    style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                    🤖
                  </div>
                )}
                <div style={{ padding: '12px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {rec.title || rec.channelTitle}
                  </h4>
                  <p style={{ fontSize: '12px', color: '#888', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rec.channelTitle}
                  </p>
                  <p style={{ fontSize: '11px', color: '#4caf50', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    🎯 {rec.reason}
                  </p>
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
