import { useQuery } from '@tanstack/react-query'
import { recommendationsApi } from '../api/client'
import './RecommendationsPage.css'

function RecommendationsPage() {
  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const response = await recommendationsApi.get()
      return response.data
    }
  })

  return (
    <div className="recommendations-page">
      <h1>AIおすすめ</h1>
      <p className="subtitle">あなたの音楽の好みに基づいておすすめします</p>

      {isLoading ? (
        <div>読み込み中...</div>
      ) : recommendations && recommendations.length > 0 ? (
        <div className="recommendations-list">
          {recommendations.map((rec) => (
            <div key={rec.videoId} className="recommendation-card">
              {rec.thumbnail && (
                <img src={rec.thumbnail} alt={rec.title} />
              )}
              <div className="rec-info">
                <h3>{rec.title}</h3>
                <p className="artist">{rec.artist}</p>
                <p className="reason">{rec.reason}</p>
              </div>
              {rec.duration && (
                <div className="duration">{rec.duration}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>おすすめはまだありません</p>
          <p>プレイリストに曲を追加すると、AIがおすすめを生成します</p>
        </div>
      )}
    </div>
  )
}

export default RecommendationsPage
