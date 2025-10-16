import './HomePage.css'

function HomePage() {
  return (
    <div className="home-page">
      <h1>YouTube Orchestrator へようこそ</h1>
      <p className="subtitle">
        YouTubeとYouTube Musicを統合管理する機能が揃っています
      </p>

      <div className="features">
        <div className="feature-card">
          <h2>プレイリスト管理</h2>
          <p>プレイリストの作成、編集、曲の追加・削除が簡単にできます</p>
        </div>

        <div className="feature-card">
          <h2>AIおすすめ</h2>
          <p>あなたの音楽の好みに基づいて、AIが新しい曲をおすすめします</p>
        </div>

        <div className="feature-card">
          <h2>アーティスト追跡</h2>
          <p>お気に入りのアーティストの新曲をいち早くチェックできます</p>
        </div>

        <div className="feature-card">
          <h2>チャンネル管理</h2>
          <p>YouTube Musicのチャンネルを一元管理できます</p>
        </div>
      </div>

      <div className="quick-actions">
        <a href="/playlists" className="action-button">
          プレイリストを見る
        </a>
        <a href="/recommendations" className="action-button secondary">
          おすすめを見る
        </a>
      </div>
    </div>
  )
}

export default HomePage
