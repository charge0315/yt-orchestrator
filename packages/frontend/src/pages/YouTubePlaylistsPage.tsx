import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { youtubeApi } from '../api/client'
import './YouTubePlaylistsPage.css'

function YouTubePlaylistsPage() {
  const { data: playlists, isLoading } = useQuery({
    queryKey: ['youtube-playlists-video'],
    queryFn: async () => {
      const response = await youtubeApi.getPlaylists()
      // バックエンドは { items: [], nextPageToken } を返す
      const data = response.data as any
      return Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    }
  })

  if (isLoading) return <div>読み込み中...</div>

  return (
    <div className="youtube-playlists-page">
      <div className="page-header">
        <h1>▶️ YouTube 再生リスト</h1>
      </div>

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
