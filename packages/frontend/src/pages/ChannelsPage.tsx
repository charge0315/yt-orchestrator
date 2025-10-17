import { useState, useEffect } from 'react'
import { youtubeDataApi, channelsApi } from '../api/client'
import './ChannelsPage.css'

function ChannelsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [channels, setChannels] = useState<any[]>([])
  const [channelVideos, setChannelVideos] = useState<{[key: string]: any[]}>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadChannels()
  }, [])

  const loadChannels = async () => {
    try {
      const response = await channelsApi.getAll()
      setChannels(response.data)
      
      // 各チャンネルの最新動画を取得
      const videosMap: {[key: string]: any[]} = {}
      for (const channel of response.data) {
        const channelId = channel.snippet?.resourceId?.channelId
        if (channelId) {
          try {
            const videos = await youtubeDataApi.searchVideos(`channel:${channelId}`, 1)
            videosMap[channel.id] = videos.data
          } catch (error) {
            console.error(`Failed to load videos for channel ${channelId}:`, error)
          }
        }
      }
      setChannelVideos(videosMap)
    } catch (error) {
      console.error('Failed to load channels:', error)
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
      await channelsApi.subscribe({ channelId: channel.channelId || channel.videoId })
      await loadChannels()
      setSearchResults(prev => prev.filter(ch => ch.channelTitle !== channel.channelTitle))
    } catch (error) {
      console.error('Failed to subscribe:', error)
    }
  }

  const handleUnsubscribe = async (subscriptionId: string) => {
    try {
      await channelsApi.unsubscribe(subscriptionId)
      await loadChannels()
    } catch (error) {
      console.error('Failed to unsubscribe:', error)
    }
  }

  return (
    <div className="channels-page">
      <div className="page-header">
        <h1>▶️ YouTube チャンネル</h1>
      </div>

      <section style={{ marginBottom: '48px' }}>
        <form onSubmit={handleSearch} style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="チャンネル名で検索..."
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
            <h2 style={{ marginBottom: '24px' }}>検索結果</h2>
            <div className="channels-grid">
              {searchResults.map((channel, index) => (
                <div key={index} className="channel-card">
                  {channel.thumbnail && (
                    <img src={channel.thumbnail} alt={channel.channelTitle} />
                  )}
                  <div className="channel-info">
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
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <h2 style={{ marginBottom: '24px' }}>登録中のチャンネル</h2>
        {isLoading ? (
          <p>読み込み中...</p>
        ) : channels.length > 0 ? (
          <div className="channels-grid">
            {channels.map((channel: any) => {
              const latestVideo = channelVideos[channel.id]?.[0]
              const thumbnail = latestVideo?.snippet?.thumbnails?.medium?.url || 
                               latestVideo?.snippet?.thumbnails?.default?.url ||
                               channel.snippet?.thumbnails?.default?.url
              return (
                <div key={channel.id} className="channel-card">
                  {thumbnail && (
                    <img src={thumbnail} alt={channel.snippet?.title} />
                  )}
                  <div className="channel-info">
                    <h3>{channel.snippet?.title}</h3>
                    <button
                      onClick={() => handleUnsubscribe(channel.id)}
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
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p>登録中のチャンネルはありません</p>
            <p>上の検索フォームからチャンネルを検索して登録してください</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default ChannelsPage
