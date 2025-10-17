import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { youtubeApi } from '../api/client'
import './PlaylistDetailPage.css'

interface Video {
  videoId: string
  title: string
  channelTitle: string
  thumbnail?: string
  duration?: string
  publishedAt?: Date
}

function YouTubePlaylistDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Video[]>([])
  const [isSearchLoading, setIsSearchLoading] = useState(false)

  // Get playlist items
  const { data: videos, isLoading } = useQuery({
    queryKey: ['youtube-playlist-items', id],
    queryFn: async () => {
      const response = await youtubeApi.getPlaylistItems(id!)
      return response.data as Video[]
    },
    enabled: !!id
  })

  // Add video mutation
  const addVideoMutation = useMutation({
    mutationFn: (videoId: string) => youtubeApi.addVideo(id!, videoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-playlist-items', id] })
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists'] })
    }
  })

  // Remove video mutation
  const removeVideoMutation = useMutation({
    mutationFn: (videoId: string) => youtubeApi.removeVideo(id!, videoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-playlist-items', id] })
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists'] })
    }
  })

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearchLoading(true)
    try {
      const response = await youtubeApi.searchVideos(searchQuery, 10)
      setSearchResults(response.data as Video[])
    } catch (error) {
      console.error('Search failed:', error)
      console.error('動画の検索に失敗しました')
    } finally {
      setIsSearchLoading(false)
    }
  }

  const handleAddVideo = (videoId: string) => {
    addVideoMutation.mutate(videoId, {
      onSuccess: () => {
        setSearchResults([])
        setSearchQuery('')
        setIsSearching(false)
      }
    })
  }

  const formatDuration = (duration?: string) => {
    if (!duration) return ''

    // Parse ISO 8601 duration (PT1H2M10S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return ''

    const hours = match[1] ? parseInt(match[1]) : 0
    const minutes = match[2] ? parseInt(match[2]) : 0
    const seconds = match[3] ? parseInt(match[3]) : 0

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (isLoading) return <div>読み込み中...</div>

  return (
    <div className="playlist-detail-page">
      <Link to="/playlists" className="back-link">
        ← プレイリスト一覧に戻る
      </Link>

      <div className="playlist-header">
        <h1>プレイリスト</h1>
        <div className="stats">
          <span>{videos?.length || 0} 動画</span>
        </div>
        <button
          className="create-button"
          onClick={() => setIsSearching(!isSearching)}
          style={{ marginTop: '16px' }}
        >
          {isSearching ? 'キャンセル' : '+ 動画を追加'}
        </button>
      </div>

      {isSearching && (
        <div className="create-form" style={{ marginBottom: '24px' }}>
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="動画を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              autoFocus
            />
            <button type="submit" className="submit-button" disabled={isSearchLoading}>
              {isSearchLoading ? '検索中...' : '検索'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="songs-list" style={{ marginTop: '16px' }}>
              {searchResults.map((video) => (
                <div key={video.videoId} className="song-item">
                  {video.thumbnail && (
                    <img src={video.thumbnail} alt={video.title} className="song-thumbnail" />
                  )}
                  <div className="song-info">
                    <div className="song-title">{video.title}</div>
                    <div className="song-artist">{video.channelTitle}</div>
                  </div>
                  {video.duration && (
                    <div className="song-duration">{formatDuration(video.duration)}</div>
                  )}
                  <button
                    className="submit-button"
                    onClick={() => handleAddVideo(video.videoId)}
                    disabled={addVideoMutation.isPending}
                    style={{ padding: '8px 16px', fontSize: '14px' }}
                  >
                    追加
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!videos || videos.length === 0 ? (
        <div className="empty-state">
          <p>このプレイリストには動画がありません</p>
        </div>
      ) : (
        <div className="songs-list">
          {videos.map((video, index) => (
            <div key={video.videoId + index} className="song-item">
              <div className="song-number">{index + 1}</div>
              {video.thumbnail && (
                <img src={video.thumbnail} alt={video.title} className="song-thumbnail" />
              )}
              <div className="song-info">
                <div className="song-title">{video.title}</div>
                <div className="song-artist">{video.channelTitle}</div>
              </div>
              {video.duration && (
                <div className="song-duration">{formatDuration(video.duration)}</div>
              )}
              <button
                className="remove-button"
                onClick={() => {
                  if (confirm('この動画をプレイリストから削除しますか?')) {
                    removeVideoMutation.mutate(video.videoId)
                  }
                }}
                disabled={removeVideoMutation.isPending}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default YouTubePlaylistDetailPage
