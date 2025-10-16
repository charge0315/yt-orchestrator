import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { playlistsApi, youtubePlaylistsApi } from '../api/client'
import './PlaylistsPage.css'

function PlaylistsPage() {
  const queryClient = useQueryClient()
  const [isCreatingMusic, setIsCreatingMusic] = useState(false)
  const [isCreatingYouTube, setIsCreatingYouTube] = useState(false)
  const [newMusicPlaylistName, setNewMusicPlaylistName] = useState('')
  const [newMusicPlaylistDesc, setNewMusicPlaylistDesc] = useState('')
  const [newYouTubePlaylistName, setNewYouTubePlaylistName] = useState('')
  const [newYouTubePlaylistDesc, setNewYouTubePlaylistDesc] = useState('')

  const { data: musicPlaylists, isLoading: isMusicLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: async () => {
      const response = await playlistsApi.getAll()
      return response.data
    }
  })

  const { data: youtubePlaylists, isLoading: isYouTubeLoading } = useQuery({
    queryKey: ['youtube-playlists'],
    queryFn: async () => {
      const response = await youtubePlaylistsApi.getAll()
      return response.data
    }
  })

  const createMusicMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      playlistsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      setIsCreatingMusic(false)
      setNewMusicPlaylistName('')
      setNewMusicPlaylistDesc('')
    }
  })

  const createYouTubeMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      youtubePlaylistsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists'] })
      setIsCreatingYouTube(false)
      setNewYouTubePlaylistName('')
      setNewYouTubePlaylistDesc('')
    }
  })

  const deleteMusicMutation = useMutation({
    mutationFn: (id: string) => playlistsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
    }
  })

  const deleteYouTubeMutation = useMutation({
    mutationFn: (id: string) => youtubePlaylistsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists'] })
    }
  })

  const handleCreateMusic = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMusicPlaylistName.trim()) return
    createMusicMutation.mutate({
      name: newMusicPlaylistName,
      description: newMusicPlaylistDesc || undefined
    })
  }

  const handleCreateYouTube = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newYouTubePlaylistName.trim()) return
    createYouTubeMutation.mutate({
      name: newYouTubePlaylistName,
      description: newYouTubePlaylistDesc || undefined
    })
  }

  if (isMusicLoading || isYouTubeLoading) return <div>読み込み中...</div>

  return (
    <div className="playlists-page">
      <div className="page-header">
        <h1>すべてのプレイリスト</h1>
      </div>

      {/* YouTube Music プレイリスト */}
      <section className="playlist-section">
        <div className="section-header">
          <h2>🎵 YouTube Music プレイリスト</h2>
          <button
            className="create-button"
            onClick={() => setIsCreatingMusic(!isCreatingMusic)}
          >
            {isCreatingMusic ? 'キャンセル' : '+ 新規作成'}
          </button>
        </div>

        {isCreatingMusic && (
          <form className="create-form" onSubmit={handleCreateMusic}>
            <input
              type="text"
              placeholder="プレイリスト名"
              value={newMusicPlaylistName}
              onChange={(e) => setNewMusicPlaylistName(e.target.value)}
              className="form-input"
              autoFocus
            />
            <textarea
              placeholder="説明（任意）"
              value={newMusicPlaylistDesc}
              onChange={(e) => setNewMusicPlaylistDesc(e.target.value)}
              className="form-textarea"
            />
            <button type="submit" className="submit-button">
              作成
            </button>
          </form>
        )}

        <div className="playlists-grid">
          {musicPlaylists?.map((playlist) => (
            <div key={playlist._id} className="playlist-card">
              <Link to={`/playlists/${playlist._id}`} className="playlist-link">
                <h3>{playlist.name}</h3>
                {playlist.description && <p>{playlist.description}</p>}
                <div className="playlist-info">
                  <span>{playlist.songs.length} 曲</span>
                </div>
              </Link>
              <button
                className="delete-button"
                onClick={() => {
                  if (confirm('このプレイリストを削除しますか?')) {
                    deleteMusicMutation.mutate(playlist._id)
                  }
                }}
              >
                削除
              </button>
            </div>
          ))}
        </div>

        {musicPlaylists?.length === 0 && !isCreatingMusic && (
          <div className="empty-state">
            <p>YouTube Musicプレイリストがありません</p>
          </div>
        )}
      </section>

      {/* YouTube 再生リスト */}
      <section className="playlist-section">
        <div className="section-header">
          <h2>▶️ YouTube 再生リスト</h2>
          <button
            className="create-button"
            onClick={() => setIsCreatingYouTube(!isCreatingYouTube)}
          >
            {isCreatingYouTube ? 'キャンセル' : '+ 新規作成'}
          </button>
        </div>

        {isCreatingYouTube && (
          <form className="create-form" onSubmit={handleCreateYouTube}>
            <input
              type="text"
              placeholder="再生リスト名"
              value={newYouTubePlaylistName}
              onChange={(e) => setNewYouTubePlaylistName(e.target.value)}
              className="form-input"
              autoFocus
            />
            <textarea
              placeholder="説明（任意）"
              value={newYouTubePlaylistDesc}
              onChange={(e) => setNewYouTubePlaylistDesc(e.target.value)}
              className="form-textarea"
            />
            <button type="submit" className="submit-button">
              作成
            </button>
          </form>
        )}

        <div className="playlists-grid">
          {youtubePlaylists?.map((playlist) => (
            <div key={playlist._id} className="playlist-card">
              <Link to={`/youtube/playlists/${playlist._id}`} className="playlist-link">
                <h3>{playlist.name}</h3>
                {playlist.description && <p>{playlist.description}</p>}
                <div className="playlist-info">
                  <span>{playlist.videos.length} 動画</span>
                </div>
              </Link>
              <button
                className="delete-button"
                onClick={() => {
                  if (confirm('この再生リストを削除しますか?')) {
                    deleteYouTubeMutation.mutate(playlist._id)
                  }
                }}
              >
                削除
              </button>
            </div>
          ))}
        </div>

        {youtubePlaylists?.length === 0 && !isCreatingYouTube && (
          <div className="empty-state">
            <p>YouTube再生リストがありません</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default PlaylistsPage
