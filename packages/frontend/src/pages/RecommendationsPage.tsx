/**
 * AIおすすめページ
 * - バックエンドの recommendationsApi からおすすめ候補を取得
 * - 推薦元チャンネル名で動画検索し、結果を表示
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { recommendationsApi, youtubeDataApi } from '../api/client'
import './RecommendationsPage.css'

function RecommendationsPage() {
  const [searchResults, setSearchResults] = useState<any[]>([])
  
  const { data: recommendations, isLoading, refetch } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const response = await recommendationsApi.get()
      return response.data
    }
  })

  /**
   * 推薦されたチャンネル名（またはタイトル）で動画を検索します。
   */
  const handleSearch = async (channelName: string) => {
    try {
      const response = await youtubeDataApi.searchVideos(channelName, 5)
      setSearchResults(response.data)
    } catch (error) {
      console.error('検索に失敗しました:', error)
    }
  }

  /**
   * YouTube を別タブで開いて再生します。
   */
  const playVideo = (videoId: string) => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')
  }

  return (
    <div className="recommendations-page">
      <h1>🤖 AIおすすめ</h1>
      <p className="subtitle">登録チャンネルに基づいてAIがおすすめを生成します</p>

      <button 
        onClick={() => refetch()} 
        style={{
          padding: '12px 24px',
          backgroundColor: '#ff0000',
          color: '#ffffff',
          borderRadius: '8px',
          marginBottom: '24px',
          fontSize: '16px',
          fontWeight: 600
        }}
      >
        おすすめを更新
      </button>

      {isLoading ? (
        <div>読み込み中...</div>
      ) : recommendations && recommendations.length > 0 ? (
        <div className="recommendations-list">
          {recommendations.map((rec: any, idx: number) => (
            <div key={rec.videoId || idx} className="recommendation-card">
              <div className="rec-info">
                <h3>{rec.title || rec.channelTitle}</h3>
                <p className="reason">🎯 {rec.reason}</p>
                <button
                  onClick={() => handleSearch(rec.channelTitle || rec.title)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2a2a2a',
                    color: '#ffffff',
                    borderRadius: '6px',
                    marginTop: '8px',
                    fontSize: '14px'
                  }}
                >
                  動画を検索
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>おすすめを生成するには、まずチャンネルを登録してください</p>
        </div>
      )}

      {searchResults.length > 0 && (
        <div style={{ marginTop: '48px' }}>
          <h2>検索結果</h2>
          <div className="recommendations-list">
            {searchResults.map((video: any) => (
              <div key={video.videoId} className="recommendation-card" onClick={() => playVideo(video.videoId)}>
                {video.thumbnail && <img src={video.thumbnail} alt={video.title} />}
                <div className="rec-info">
                  <h3>{video.title}</h3>
                  <p className="artist">{video.channelTitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default RecommendationsPage
