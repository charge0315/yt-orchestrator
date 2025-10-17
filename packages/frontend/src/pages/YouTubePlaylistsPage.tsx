import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { youtubeApi, youtubeOAuthApi } from '../api/client'
import './YouTubePlaylistsPage.css'

function YouTubePlaylistsPage() {
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('')
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false)
  const [isCheckingConnection, setIsCheckingConnection] = useState(true)

  // Check YouTube connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await youtubeOAuthApi.getStatus()
        setIsYouTubeConnected(response.data.connected)
      } catch (error) {
        console.error('Failed to check YouTube connection:', error)
        setIsYouTubeConnected(false)
      } finally {
        setIsCheckingConnection(false)
      }
    }
    checkConnection()
  }, [])

  // Get YouTube playlists (only if connected)
  const { data: playlists, isLoading, error } = useQuery({
    queryKey: ['youtube-playlists-video'],
    queryFn: async () => {
      const response = await youtubeApi.getPlaylists()
      return response.data
    },
    enabled: isYouTubeConnected
  })

  // Create playlist mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      youtubeApi.createPlaylist(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists-video'] })
      setIsCreating(false)
      setNewPlaylistName('')
      setNewPlaylistDesc('')
    }
  })

  // Delete playlist mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => youtubeApi.deletePlaylist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists-video'] })
    }
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlaylistName.trim()) return
    createMutation.mutate({
      name: newPlaylistName,
      description: newPlaylistDesc || undefined
    })
  }

  const handleConnectYouTube = async () => {
    try {
      const response = await youtubeOAuthApi.getAuthUrl()
      window.location.href = response.data.url
    } catch (error) {
      console.error('Failed to get YouTube auth URL:', error)
      console.error('YouTube連携URLの取得に失敗しました')
    }
  }

  // Helper function to get playlist thumbnail from first video
  const getPlaylistThumbnail = (playlist: any) => {
    if (playlist.thumbnail) {
      return playlist.thumbnail
    }
    // Get thumbnail from first video that has one
    if (playlist.videos && playlist.videos.length > 0) {
      const videoWithThumbnail = playlist.videos.find((v: any) => v.thumbnail)
      return videoWithThumbnail?.thumbnail
    }
    return null
  }

  if (isCheckingConnection) {
    return <div>接続状態を確認中...</div>
  }

  if (!isYouTubeConnected) {
    return (
      <div className="youtube-playlists-page">
        <div className="page-header">
          <h1>▶️ YouTube 再生リスト</h1>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          margin: '20px 0'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>▶️</div>
          <h2>YouTubeアカウント連携が必要です</h2>
          <p style={{ color: '#aaa', marginBottom: '30px' }}>
            あなたのYouTube再生リストを表示・管理するには、
            <br />
            YouTubeアカウントとの連携が必要です。
          </p>
          <button
            onClick={handleConnectYouTube}
            className="create-button"
            style={{ fontSize: '16px', padding: '16px 32px' }}
          >
            YouTube連携する
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) return <div>読み込み中...</div>

  if (error) {
    return (
      <div className="youtube-playlists-page">
        <div className="page-header">
          <h1>▶️ YouTube 再生リスト</h1>
        </div>
        <div className="empty-state">
          <p>再生リストの読み込みに失敗しました</p>
          <button onClick={handleConnectYouTube} className="create-button">
            再接続する
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="youtube-playlists-page">
      <div className="page-header">
        <h1>▶️ YouTube 再生リスト</h1>
        <button
          className="create-button video-theme"
          onClick={() => setIsCreating(!isCreating)}
        >
          {isCreating ? 'キャンセル' : '+ 新規作成'}
        </button>
      </div>

      {isCreating && (
        <form className="create-form video-theme" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="再生リスト名"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className="form-input"
            autoFocus
          />
          <textarea
            placeholder="説明（任意）"
            value={newPlaylistDesc}
            onChange={(e) => setNewPlaylistDesc(e.target.value)}
            className="form-textarea"
          />
          <button type="submit" className="submit-button video-theme">
            作成
          </button>
        </form>
      )}

      <div className="playlists-grid">
        {playlists?.map((playlist: any) => {
          const thumbnail = getPlaylistThumbnail(playlist)
          return (
            <div key={playlist._id} className="playlist-card video-theme">
              <Link to={`/youtube/playlists/${playlist._id}`} className="playlist-link">
                {thumbnail ? (
                  <div className="playlist-thumbnail video-theme">
                    <img src={thumbnail} alt={playlist.name} />
                    <div className="video-overlay">▶️</div>
                  </div>
                ) : (
                  <div className="playlist-thumbnail video-theme">
                    <div className="placeholder-thumbnail video-theme">▶️</div>
                  </div>
                )}
                <h3>{playlist.name}</h3>
                {playlist.description && <p>{playlist.description}</p>}
                <div className="playlist-info">
                  <span>📹 {playlist.videos?.length || playlist.itemCount || 0} 動画</span>
                </div>
              </Link>
              <button
                className="delete-button video-theme"
                onClick={() => {
                  if (confirm('この再生リストを削除しますか?')) {
                    deleteMutation.mutate(playlist._id)
                  }
                }}
              >
                削除
              </button>
            </div>
          )
        })}
      </div>

      {playlists?.length === 0 && !isCreating && (
        <div className="empty-state">
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>▶️</div>
          <p>再生リストがありません</p>
          <p>「+ 新規作成」をクリックして最初の再生リストを作成しましょう</p>
        </div>
      )}
    </div>
  )
}

export default YouTubePlaylistsPage
