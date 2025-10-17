import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { youtubeDataApi, ytmusicApi } from '../api/client'
import './PlaylistsPage.css'

function PlaylistsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('')
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false)
  const [isCheckingConnection, setIsCheckingConnection] = useState(true)

  // Check YouTube connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await youtubeDataApi.getAuthStatus()
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
  const { data: youtubePlaylists, isLoading: isYouTubeLoading, error: youtubeError } = useQuery({
    queryKey: ['youtube-playlists'],
    queryFn: async () => {
      const response = await youtubeDataApi.getPlaylists()
      return response.data
    },
    enabled: isYouTubeConnected
  })

  // Get YouTube Music playlists (same as YouTube playlists)
  const { data: musicPlaylists, isLoading: isMusicLoading, error: musicError } = useQuery({
    queryKey: ['ytmusic-playlists'],
    queryFn: async () => {
      const response = await youtubeDataApi.getPlaylists()
      return response.data
    },
    enabled: isYouTubeConnected,
    retry: false
  })

  // Create playlist mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      youtubeDataApi.createPlaylist(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists'] })
      setIsCreating(false)
      setNewPlaylistName('')
      setNewPlaylistDesc('')
    }
  })

  // Delete playlist mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => youtubeDataApi.deletePlaylist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists'] })
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
      const response = await youtubeDataApi.getAuthUrl()
      window.location.href = response.data.url
    } catch (error) {
      console.error('Failed to get YouTube auth URL:', error)
      alert('YouTube連携URLの取得に失敗しました')
    }
  }

  if (isCheckingConnection) {
    return <div>接続状態を確認中...</div>
  }

  if (!isYouTubeConnected) {
    return (
      <div className="playlists-page">
        <div className="page-header">
          <h1>YouTube プレイリスト</h1>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          margin: '20px 0'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>📺</div>
          <h2>YouTubeアカウント連携が必要です</h2>
          <p style={{ color: '#aaa', marginBottom: '30px' }}>
            あなたのYouTubeプレイリストを表示・管理するには、
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

  if (isYouTubeLoading || isMusicLoading) return <div>読み込み中...</div>

  if (youtubeError || musicError) {
    return (
      <div className="playlists-page">
        <div className="page-header">
          <h1>YouTube プレイリスト</h1>
        </div>
        <div className="empty-state">
          <p>プレイリストの読み込みに失敗しました</p>
          <button onClick={handleConnectYouTube} className="create-button">
            再接続する
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="playlists-page">
      {/* YouTube Music プレイリスト */}
      <section className="playlist-section">
        <div className="section-header">
          <h2>🎵 YouTube Music プレイリスト</h2>
        </div>

        <>
            <div className="playlists-grid">
              {musicPlaylists?.map((playlist: any) => (
                <div key={playlist._id} className="playlist-card">
                  <Link to={`/playlists/${playlist._id}`} className="playlist-link">
                    <div className="playlist-thumbnail">
                      {playlist.thumbnail ? (
                        <img src={playlist.thumbnail} alt={playlist.name} />
                      ) : (
                        <div className="placeholder-thumbnail">🎵</div>
                      )}
                    </div>
                    <h3>{playlist.name}</h3>
                    {playlist.description && <p>{playlist.description}</p>}
                    <div className="playlist-info">
                      <span>{playlist.itemCount || 0} 曲</span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

          {musicPlaylists?.length === 0 && (
            <div className="empty-state">
              <p>YouTube Musicプレイリストがありません</p>
            </div>
          )}
        </>
      </section>

      {/* YouTube 再生リスト */}
      <section className="playlist-section">
        <div className="section-header">
          <h2>▶️ YouTube 再生リスト</h2>
          <button
            className="create-button"
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? 'キャンセル' : '+ 新規作成'}
          </button>
        </div>

      {isCreating && (
        <form className="create-form music-theme" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="プレイリスト名"
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
          <button type="submit" className="submit-button music-theme">
            作成
          </button>
        </form>
      )}

        <div className="playlists-grid">
          {youtubePlaylists?.map((playlist: any) => (
            <div key={playlist._id} className="playlist-card">
              <Link to={`/youtube/playlists/${playlist._id}`} className="playlist-link">
                <div className="playlist-thumbnail">
                  {playlist.thumbnail ? (
                    <img src={playlist.thumbnail} alt={playlist.name} />
                  ) : (
                    <div className="placeholder-thumbnail">▶️</div>
                  )}
                </div>
                <h3>{playlist.name}</h3>
                {playlist.description && <p>{playlist.description}</p>}
                <div className="playlist-info">
                  <span>{playlist.itemCount || 0} 動画</span>
                </div>
              </Link>
              <button
                className="delete-button"
                onClick={() => {
                  if (confirm('この再生リストを削除しますか?')) {
                    deleteMutation.mutate(playlist._id)
                  }
                }}
              >
                削除
              </button>
            </div>
          ))}
        </div>

        {youtubePlaylists?.length === 0 && !isCreating && (
          <div className="empty-state">
            <p>YouTube再生リストがありません</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default PlaylistsPage
