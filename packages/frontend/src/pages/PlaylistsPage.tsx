import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ytmusicApi } from '../api/client'
import './PlaylistsPage.css'

function PlaylistsPage() {

  const { data: musicPlaylists, isLoading: isMusicLoading } = useQuery({
    queryKey: ['ytmusic-playlists'],
    queryFn: async () => {
      const response = await ytmusicApi.getPlaylists()
      // バックエンドは { items: [], nextPageToken } を返す
      const data = response.data as any
      return Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    },
    retry: false
  })



  if (isMusicLoading) return <div>読み込み中...</div>

  return (
    <div className="playlists-page">
      <div className="page-header">
        <h1>🎵 YouTube Music プレイリスト</h1>
      </div>

      <div className="playlists-grid">
        {Array.isArray(musicPlaylists) && musicPlaylists.map((playlist: any) => {
          const thumbnail = playlist.snippet?.thumbnails?.medium?.url || 
                           playlist.snippet?.thumbnails?.default?.url
          return (
            <div key={playlist.id} className="playlist-card">
              <Link to={`/playlists/${playlist.id}`} className="playlist-link">
                <div className="playlist-thumbnail">
                  {thumbnail ? (
                    <img src={thumbnail} alt={playlist.snippet?.title} />
                  ) : (
                    <div className="placeholder-thumbnail">🎵</div>
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
                  <span>🎵 {playlist.contentDetails?.itemCount || 0} 曲</span>
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      {musicPlaylists?.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎵</div>
          <p>YouTube Musicプレイリストがありません</p>
        </div>
      )}
    </div>
  )
}

export default PlaylistsPage
