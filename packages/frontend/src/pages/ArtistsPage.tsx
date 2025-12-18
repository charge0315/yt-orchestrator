/**
 * アーティスト（チャンネル）管理ページ
 * - YouTube Data API で検索し、アーティスト（チャンネル）として登録/解除
 * - 登録済みアーティストの最新動画を再生
 */
import { useState, useEffect } from 'react'
import { youtubeDataApi, artistsApi } from '../api/client'
import VideoPlayer from '../components/VideoPlayer'
import './ArtistsPage.css'

function ArtistsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [artists, setArtists] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)

  useEffect(() => {
    loadArtists()
  }, [])

  /**
   * 登録済みアーティスト一覧を取得します。
   */
  const loadArtists = async () => {
    try {
      const response = await artistsApi.getAll()
      setArtists(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('アーティスト一覧の読み込みに失敗しました:', error)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 入力されたクエリで動画検索し、チャンネル単位にまとめて表示します。
   */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await youtubeDataApi.searchVideos(searchQuery, 10)
      // 検索結果からチャンネルを重複排除して抽出
      const searchData = Array.isArray(response.data) ? response.data : []
      const channels = searchData.reduce((acc: any[], video: any) => {
        if (!acc.find(ch => ch.channelTitle === video.channelTitle)) {
          acc.push({
            channelTitle: video.channelTitle,
            thumbnail: video.thumbnail,
            videoId: video.videoId
          })
        }
        return acc
      }, [])
      setSearchResults(channels)
    } catch (error) {
      console.error('検索に失敗しました:', error)
    } finally {
      setIsSearching(false)
    }
  }

  /**
   * 検索結果のチャンネルを「アーティスト」として登録します。
   */
  const handleSubscribe = async (channel: any) => {
    try {
      await artistsApi.subscribe({ channelId: channel.channelId || channel.videoId })
      await loadArtists()
      setSearchResults(prev => prev.filter(ch => ch.channelTitle !== channel.channelTitle))
    } catch (error) {
      console.error('登録に失敗しました:', error)
    }
  }

  /**
   * 登録済みアーティストを解除します。
   */
  const handleUnsubscribe = async (subscriptionId: string) => {
    try {
      await artistsApi.unsubscribe(subscriptionId)
      await loadArtists()
    } catch (error) {
      console.error('解除に失敗しました:', error)
    }
  }

  /**
   * アーティストカードをクリックした際、最新動画を検索して再生します。
   */
  const handleArtistClick = async (artist: any) => {
    try {
      const channelId = artist.snippet?.resourceId?.channelId || artist.id
      const response = await youtubeDataApi.searchVideos(`channel:${channelId}`, 1)
      if (response.data.length > 0) {
        const videoId = response.data[0].id?.videoId || response.data[0].videoId
        if (videoId) {
          setPlayingVideoId(videoId)
        }
      }
    } catch (error) {
      console.error('最新動画の取得に失敗しました:', error)
    }
  }

  return (
    <div className="artists-page">
      {/* 動画プレイヤーモーダル */}
      <VideoPlayer videoId={playingVideoId} onClose={() => setPlayingVideoId(null)} />

      <h1>🎵 アーティスト検索</h1>

      <section className="section">
        <form onSubmit={handleSearch} style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="アーティスト名で検索..."
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '16px'
              }}
            />
            <button
              type="submit"
              disabled={isSearching}
              style={{
                padding: '12px 32px',
                backgroundColor: '#ff0000',
                color: '#ffffff',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600
              }}
            >
              {isSearching ? '検索中...' : '検索'}
            </button>
          </div>
        </form>

        {searchResults.length > 0 && (
          <>
            <h2>検索結果</h2>
            <div className="artists-grid">
              {searchResults.map((channel, index) => (
                <div key={index} className="artist-card">
                  {channel.thumbnail && (
                    <img src={channel.thumbnail} alt={channel.channelTitle} />
                  )}
                  <h3>{channel.channelTitle}</h3>
                  <button
                    onClick={() => handleSubscribe(channel)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ff0000',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontSize: '14px',
                      marginTop: '8px'
                    }}
                  >
                    登録
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="section">
        <h2>登録中のアーティスト</h2>
        {isLoading ? (
          <p>読み込み中...</p>
        ) : artists.length > 0 ? (
          <div className="artists-grid">
            {artists.map((artist: any) => (
              <div key={artist.id} className="artist-card">
                {artist.snippet?.thumbnails?.default?.url && (
                  <div
                    className="artist-thumbnail"
                    onClick={() => handleArtistClick(artist)}
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    <img
                      src={artist.snippet.thumbnails.default.url}
                      alt={artist.snippet.title}
                    />
                    {/* サムネイルホバー時の再生オーバーレイ */}
                    <div className="play-overlay">▶</div>
                  </div>
                )}
                <div className="artist-info">
                  <h3>{artist.snippet?.title}</h3>
                  <button
                    onClick={() => handleUnsubscribe(artist.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#2a2a2a',
                      color: '#ff4444',
                      borderRadius: '6px',
                      fontSize: '14px',
                      marginTop: '8px',
                      width: '100%'
                    }}
                  >
                    登録解除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>登録中のアーティストはありません</p>
            <p>上の検索フォームからアーティストを検索して登録してください</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default ArtistsPage
