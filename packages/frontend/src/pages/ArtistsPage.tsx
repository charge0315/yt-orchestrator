import { useState, useEffect } from 'react'
import { youtubeDataApi, artistsApi } from '../api/client'
import './ArtistsPage.css'

function ArtistsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [artists, setArtists] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadArtists()
  }, [])

  const loadArtists = async () => {
    try {
      const response = await artistsApi.getAll()
      setArtists(response.data)
    } catch (error) {
      console.error('Failed to load artists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await youtubeDataApi.searchVideos(searchQuery, 10)
      // Extract unique channels from search results
      const channels = response.data.reduce((acc: any[], video: any) => {
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
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSubscribe = async (channel: any) => {
    try {
      await artistsApi.subscribe({ channelId: channel.channelId || channel.videoId })
      await loadArtists()
      setSearchResults(prev => prev.filter(ch => ch.channelTitle !== channel.channelTitle))
    } catch (error) {
      console.error('Failed to subscribe:', error)
    }
  }

  const handleUnsubscribe = async (subscriptionId: string) => {
    try {
      await artistsApi.unsubscribe(subscriptionId)
      await loadArtists()
    } catch (error) {
      console.error('Failed to unsubscribe:', error)
    }
  }

  return (
    <div className="artists-page">
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
                  <img src={artist.snippet.thumbnails.default.url} alt={artist.snippet.title} />
                )}
                <h3>{artist.snippet?.title}</h3>
                <button
                  onClick={() => handleUnsubscribe(artist.id)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2a2a2a',
                    color: '#ff4444',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginTop: '8px'
                  }}
                >
                  登録解除
                </button>
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
