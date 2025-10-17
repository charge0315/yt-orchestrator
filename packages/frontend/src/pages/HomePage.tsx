import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { channelsApi, playlistsApi, artistsApi, ytmusicApi, youtubeDataApi, recommendationsApi } from '../api/client'
import './HomePage.css'

function HomePage() {
  const navigate = useNavigate()
  const [channels, setChannels] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [artists, setArtists] = useState<any[]>([])
  const [ytmPlaylists, setYtmPlaylists] = useState<any[]>([])
  const [channelSort, setChannelSort] = useState<'recent' | 'name'>('recent')
  const [playlistSort, setPlaylistSort] = useState<'recent' | 'name'>('recent')
  const [artistSort, setArtistSort] = useState<'recent' | 'name'>('recent')
  const [ytmPlaylistSort, setYtmPlaylistSort] = useState<'recent' | 'name'>('recent')
  const [latestVideos, setLatestVideos] = useState<any[]>([])
  const [loadingLatest, setLoadingLatest] = useState(true)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loadingRecs, setLoadingRecs] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [channelsRes, playlistsRes, artistsRes] = await Promise.all([
        channelsApi.getAll().catch((err) => { 
          if (err.response?.status === 401 || err.response?.status === 500) setIsAuthenticated(false)
          return { data: [] } 
        }),
        playlistsApi.getAll().catch((err) => { return { data: [] } }),
        artistsApi.getAll().catch((err) => { return { data: [] } })
      ])
      
      if (channelsRes.data?.length > 0 || playlistsRes.data?.length > 0 || artistsRes.data?.length > 0) {
        setIsAuthenticated(true)
      }
      
      setChannels(channelsRes.data || [])
      setPlaylists(playlistsRes.data || [])
      setArtists(artistsRes.data || [])
      
      try {
        const ytmRes = await ytmusicApi.getPlaylists()
        setYtmPlaylists(ytmRes.data || [])
      } catch {}

      await loadLatestVideos([...channelsRes.data, ...artistsRes.data])
      await loadRecommendations()
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

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

  const hasRecentUpdate = (channel: any) => {
    const publishedAt = channel.snippet?.publishedAt || channel.contentDetails?.relatedPlaylists?.uploads
    if (!publishedAt) return false
    const daysSinceUpdate = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceUpdate <= 7
  }

  const handleChannelClick = async (channel: any) => {
    try {
      const channelId = channel.snippet?.resourceId?.channelId || channel.id
      const response = await youtubeDataApi.searchVideos(`channel:${channelId}`, 1)
      if (response.data.length > 0) {
        const videoId = response.data[0].videoId
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')
      }
    } catch (error) {
      console.error('Failed to get latest video:', error)
      navigate('/channels')
    }
  }

  const sortItems = (items: any[], sortType: 'recent' | 'name') => {
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

  const playVideo = (videoId: string) => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')
  }

  return (
    <div className="home-page">
      <h1>YouTube Orchestrator</h1>
      
      {!isAuthenticated && (
        <div style={{ backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '8px', marginBottom: '24px', border: '2px solid #ff0000' }}>
          <h3 style={{ color: '#ff0000', marginBottom: '12px' }}>🔐 ログインが必要です</h3>
          <p style={{ marginBottom: '12px' }}>YouTube Orchestratorの機能を使用するには、Googleアカウントでログインしてください。</p>
          <button 
            onClick={() => window.location.href = 'http://localhost:3001/api/auth/google'}
            style={{ backgroundColor: '#ff0000', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
          >
            Googleでログイン
          </button>
        </div>
      )}

      <section className="latest-section" style={{ marginBottom: '32px', backgroundColor: '#1a1a1a', padding: '24px', borderRadius: '12px', border: '1px solid #2a2a2a' }}>
        <h2>🆕 最新情報</h2>
        {loadingLatest ? (
          <p>読み込み中...</p>
        ) : latestVideos.length > 0 ? (
          <div className="items-scroll">
            {latestVideos.map((video: any, idx: number) => (
              <div key={idx} style={{ minWidth: '150px', width: '150px', flexShrink: 0, backgroundColor: '#2a2a2a', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => playVideo(video.videoId)}>
                {video.thumbnail && (
                  <img src={video.thumbnail} alt={video.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                )}
                <div style={{ padding: '12px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title}</h4>
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
                {ch.snippet?.thumbnails?.default?.url && (
                  <img src={ch.snippet.thumbnails.default.url} alt={ch.snippet.title} />
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
                {artist.snippet?.thumbnails?.default?.url && (
                  <img src={artist.snippet.thumbnails.default.url} alt={artist.snippet.title} />
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
          <p>読み込み中...</p>
        ) : recommendations.length > 0 ? (
          <div className="items-scroll">
            {recommendations.map((rec: any, idx: number) => (
              <div key={idx} style={{ minWidth: '150px', width: '150px', flexShrink: 0, backgroundColor: '#2a2a2a', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigate('/recommendations')}>
                <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                  🤖
                </div>
                <div style={{ padding: '12px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.title || rec.channelTitle}</h4>
                  <p style={{ fontSize: '12px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎯 {rec.reason}</p>
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
