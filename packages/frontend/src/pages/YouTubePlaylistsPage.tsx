import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { youtubeApi, playlistsApi } from '../api/client'
import { useState, useRef } from 'react'
import './YouTubePlaylistsPage.css'

function YouTubePlaylistsPage() {
  const queryClient = useQueryClient()
  const [importStatus, setImportStatus] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: playlists, isLoading } = useQuery({
    queryKey: ['youtube-playlists-video'],
    queryFn: async () => {
      const response = await youtubeApi.getPlaylists()
      // バックエンドは { items: [], nextPageToken } を返す
      const data = response.data as any
      return Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    }
  })

  // エクスポート処理
  const handleExport = async (playlistId: string, playlistTitle: string) => {
    try {
      const response = await playlistsApi.export(playlistId)
      const blob = new Blob([response.data], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${playlistTitle.replace(/[^a-z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/gi, '_')}_${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      alert('プレイリストをエクスポートしました')
    } catch (error) {
      console.error('Export error:', error)
      alert('エクスポートに失敗しました')
    }
  }

  // インポート処理
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text()
      const data = JSON.parse(text)
      return playlistsApi.import(data)
    },
    onSuccess: (response) => {
      const stats = response.data.stats
      setImportStatus(`インポート完了: ${stats.added}/${stats.total} 件追加`)
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists-video'] })
      setTimeout(() => setImportStatus(''), 5000)
    },
    onError: (error) => {
      console.error('Import error:', error)
      setImportStatus('インポートに失敗しました')
      setTimeout(() => setImportStatus(''), 5000)
    }
  })

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      importMutation.mutate(file)
    }
  }

  if (isLoading) return <div>読み込み中...</div>

  return (
    <div className="youtube-playlists-page">
      <div className="page-header">
        <h1>▶️ YouTube 再生リスト</h1>
        <div className="playlist-actions">
          <button
            className="import-button video-theme"
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? 'インポート中...' : 'プレイリストをインポート'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
      </div>
      {importStatus && (
        <div className="import-status video-theme">{importStatus}</div>
      )}

      <div className="playlists-grid">
        {playlists?.map((playlist: any) => {
          const thumbnail = playlist.snippet?.thumbnails?.medium?.url ||
                           playlist.snippet?.thumbnails?.default?.url
          return (
            <div key={playlist.id} className="playlist-card video-theme">
              <Link to={`/youtube/playlists/${playlist.id}`} className="playlist-link">
                <div className="playlist-thumbnail video-theme">
                  {thumbnail ? (
                    <>
                      <img src={thumbnail} alt={playlist.snippet?.title} />
                      <div className="video-overlay">▶️</div>
                    </>
                  ) : (
                    <div className="placeholder-thumbnail video-theme">▶️</div>
                  )}
                </div>
                <h3>{playlist.snippet?.title}</h3>
                {playlist.snippet?.description && (
                  <p className="playlist-description">
                    {playlist.snippet.description.substring(0, 100)}
                    {playlist.snippet.description.length > 100 ? '...' : ''}
                  </p>
                )}
                <div className="playlist-info">
                  <span>📹 {playlist.contentDetails?.itemCount || 0} 動画</span>
                </div>
              </Link>
              <button
                className="export-button video-theme"
                onClick={(e) => {
                  e.preventDefault()
                  handleExport(playlist.id, playlist.snippet?.title || 'playlist')
                }}
              >
                エクスポート
              </button>
            </div>
          )
        })}
      </div>

      {playlists?.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>▶️</div>
          <p>再生リストがありません</p>
        </div>
      )}
    </div>
  )
}

export default YouTubePlaylistsPage
