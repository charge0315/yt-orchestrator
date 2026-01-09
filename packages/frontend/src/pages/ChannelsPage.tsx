/**
 * YouTube チャンネル管理ページ
 * - YouTube Data API で検索し、チャンネルとして登録/解除
 * - 登録済みチャンネルの最新動画を再生
 */
import { useState, useEffect } from 'react'
import { youtubeDataApi, channelsApi } from '../api/client'
import VideoPlayer from '../components/VideoPlayer'
import './ChannelsPage.css'

function ChannelsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [channels, setChannels] = useState<any[]>([])
  const [channelVideos, setChannelVideos] = useState<{[key: string]: any[]}>({})
  const [isLoading, setIsLoading] = useState(true)
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)

  useEffect(() => {
    loadChannels()
  }, [])

  /**
   * 登録済みチャンネル一覧を取得し、各チャンネルの最新動画も補完します。
   */
  const loadChannels = async () => {
    try {
      const response = await channelsApi.getAll()
      const channelsData = Array.isArray(response.data) ? response.data : []
      setChannels(channelsData)

      // 各チャンネルの最新動画を取得
      const videosMap: {[key: string]: any[]} = {}
      for (const channel of channelsData) {
        const channelId = channel.snippet?.resourceId?.channelId
        if (channelId) {
          try {
            const videos = await youtubeDataApi.searchVideos(`channel:${channelId}`, 1)
            videosMap[channel.id] = Array.isArray(videos.data) ? videos.data : []
          } catch (error) {
            console.error(`チャンネル(${channelId})の動画取得に失敗しました:`, error)
          }
        }
      }
      setChannelVideos(videosMap)
    } catch (error) {
      console.error('チャンネル一覧の読み込みに失敗しました:', error)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * クエリで動画検索し、チャンネル単位にまとめて表示します。
   */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await youtubeDataApi.searchVideos(searchQuery, 10)
      const searchData = Array.isArray(response.data) ? response.data : []
      const channels = searchData.reduce((acc: any[], video: any) => {
        if (!acc.find(ch => ch.channelTitle === video.channelTitle)) {
          acc.push({
            channelTitle: video.channelTitle,
            thumbnail: video.thumbnail,
            videoId: video.videoId,
            channelId: video.channelId
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
   * 検索結果のチャンネルを登録します。
   */
  const handleSubscribe = async (channel: any) => {
    try {
      await channelsApi.subscribe({ channelId: channel.channelId || channel.videoId })
      await loadChannels()
      setSearchResults(prev => prev.filter(ch => ch.channelTitle !== channel.channelTitle))
    } catch (error) {
      console.error('登録に失敗しました:', error)
    }
  }

  /**
   * 登録済みチャンネルを解除します。
   */
  const handleUnsubscribe = async (subscriptionId: string) => {
    try {
      await channelsApi.unsubscribe(subscriptionId)
      await loadChannels()
    } catch (error) {
      console.error('解除に失敗しました:', error)
    }
  }

  /**
   * チャンネルカードクリック時に最新動画を選択して再生します。
   * バックエンド提供の latestVideoId を優先し、無い場合はフロント側検索結果でフォールバックします。
   */
  const handleChannelClick = (channel: any) => {
    // バックエンドから提供される最新動画IDを優先的に使用
    if (channel.latestVideoId) {
      setPlayingVideoId(channel.latestVideoId)
      return
    }

    // フォールバック: フロントエンドで取得した動画情報を使用
    const latestVideo = channelVideos[channel.id]?.[0]
    if (latestVideo) {
      const videoId = latestVideo.id?.videoId || latestVideo.videoId
      if (videoId) {
        setPlayingVideoId(videoId)
      }
    }
  }

  return (
    <div className="channels-page">
      {/* 動画プレイヤーモーダル */}
      <VideoPlayer videoId={playingVideoId} onClose={() => setPlayingVideoId(null)} />

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
              // バックエンドから提供される最新動画のサムネイルを優先的に使用
              const thumbnail = channel.latestVideoThumbnail ||
                               latestVideo?.snippet?.thumbnails?.medium?.url ||
                               latestVideo?.snippet?.thumbnails?.default?.url ||
                               channel.snippet?.thumbnails?.default?.url
              // 最新動画タイトルの表示（バックエンド提供があれば優先）
              const latestTitle = channel.latestVideoTitle || latestVideo?.snippet?.title
              return (
                <div key={channel.id} className="channel-card">
                  {thumbnail && (
                    <div
                      className="channel-thumbnail"
                      onClick={() => handleChannelClick(channel)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <img
                        src={thumbnail}
                        alt={channel.snippet?.title}
                      />
                      {/* サムネイルホバー時の再生オーバーレイ */}
                      <div className="play-overlay">▶</div>
                    </div>
                  )}
                  <div className="channel-info">
                    <h3>{channel.snippet?.title}</h3>
                    {latestTitle && (
                      <p style={{ color: '#aaa', marginTop: '6px', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {latestTitle}
                      </p>
                    )}
                    <button
                      onClick={() => handleUnsubscribe(channel.id)}
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
