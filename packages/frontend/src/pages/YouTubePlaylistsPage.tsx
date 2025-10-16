import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { youtubePlaylistsApi } from '../api/client'
import './YouTubePlaylistsPage.css'

function YouTubePlaylistsPage() {
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('')

  const { data: playlists, isLoading } = useQuery({
    queryKey: ['youtubePlaylists'],
    queryFn: async () => {
      const response = await youtubePlaylistsApi.getAll()
      return response.data
    }
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      youtubePlaylistsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtubePlaylists'] })
      setIsCreating(false)
      setNewPlaylistName('')
      setNewPlaylistDesc('')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => youtubePlaylistsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtubePlaylists'] })
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

  if (isLoading) return <div>読み込み中...</div>

  return (
    <div className="youtube-playlists-page">
      <div className="page-header">
        <h1>YouTube 再生リスト</h1>
        <button
          className="create-button"
          onClick={() => setIsCreating(!isCreating)}
        >
          {isCreating ? 'キャンセル' : '+ 新規作成'}
        </button>
      </div>

      {isCreating && (
        <form className="create-form" onSubmit={handleCreate}>
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
          <button type="submit" className="submit-button">
            作成
          </button>
        </form>
      )}

      <div className="playlists-grid">
        {playlists?.map((playlist) => (
          <div key={playlist._id} className="playlist-card">
            <Link to={`/youtube/playlists/${playlist._id}`} className="playlist-link">
              <div className="playlist-icon">▶️</div>
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
                  deleteMutation.mutate(playlist._id)
                }
              }}
            >
              削除
            </button>
          </div>
        ))}
      </div>

      {playlists?.length === 0 && !isCreating && (
        <div className="empty-state">
          <p>再生リストがありません</p>
          <p>「+ 新規作成」をクリックして最初の再生リストを作成しましょう</p>
        </div>
      )}
    </div>
  )
}

export default YouTubePlaylistsPage
