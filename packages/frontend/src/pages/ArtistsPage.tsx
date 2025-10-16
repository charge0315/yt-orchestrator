import { useQuery } from '@tanstack/react-query'
import { artistsApi } from '../api/client'
import './ArtistsPage.css'

function ArtistsPage() {
  const { data: artists, isLoading: artistsLoading } = useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      const response = await artistsApi.getAll()
      return response.data
    }
  })

  const { data: newReleases, isLoading: releasesLoading } = useQuery({
    queryKey: ['newReleases'],
    queryFn: async () => {
      const response = await artistsApi.getNewReleases()
      return response.data
    }
  })

  return (
    <div className="artists-page">
      <h1>登録アーティスト</h1>

      <section className="section">
        <h2>新曲一覧</h2>
        {releasesLoading ? (
          <div>読み込み中...</div>
        ) : newReleases && newReleases.length > 0 ? (
          <div className="releases-grid">
            {newReleases.map((release: any) => (
              <div key={release.videoId} className="release-card">
                {release.thumbnail && (
                  <img src={release.thumbnail} alt={release.title} />
                )}
                <h3>{release.title}</h3>
                <p>{release.artistName}</p>
                <span className="release-date">
                  {new Date(release.releaseDate).toLocaleDateString('ja-JP')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>新曲はありません</p>
          </div>
        )}
      </section>

      <section className="section">
        <h2>登録中のアーティスト</h2>
        {artistsLoading ? (
          <div>読み込み中...</div>
        ) : artists && artists.length > 0 ? (
          <div className="artists-grid">
            {artists.map((artist) => (
              <div key={artist._id} className="artist-card">
                {artist.thumbnail && (
                  <img src={artist.thumbnail} alt={artist.name} />
                )}
                <h3>{artist.name}</h3>
                <p>{artist.newReleases.length} 新曲</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>登録中のアーティストはありません</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default ArtistsPage
