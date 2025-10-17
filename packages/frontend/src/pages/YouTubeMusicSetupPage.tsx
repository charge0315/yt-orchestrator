/**
 * YouTube Music情報ページ
 * YouTube Data API v3を使用しているため、特別な設定は不要
 */
import { useNavigate } from 'react-router-dom';
import './YouTubeMusicSetupPage.css';

function YouTubeMusicSetupPage() {
  const navigate = useNavigate();

  return (
    <div className="ytmusic-setup-page">
      <div className="setup-container">
        <h1>🎵 YouTube Music について</h1>

        <div style={{ backgroundColor: '#2a3a2a', padding: '24px', borderRadius: '12px', marginBottom: '24px' }}>
          <h2 style={{ color: '#4caf50', marginBottom: '16px' }}>✅ すでに連携済みです！</h2>
          <p style={{ fontSize: '16px', lineHeight: '1.6' }}>
            YouTube OrchestratorはYouTube Data API v3を使用しています。<br />
            GoogleアカウントでログインするだけでYouTubeとYouTube Musicの両方にアクセスできます。
          </p>
        </div>

        <div className="instructions">
          <h2>📌 利用可能な機能</h2>
          <ul style={{ fontSize: '16px', lineHeight: '1.8', marginLeft: '20px' }}>
            <li>
              <strong>プレイリスト管理</strong><br />
              YouTubeとYouTube Musicのプレイリストを統合的に管理できます
            </li>
            <li>
              <strong>チャンネル登録</strong><br />
              お気に入りのアーティストやチャンネルを登録して最新動画をチェック
            </li>
            <li>
              <strong>動画検索</strong><br />
              YouTube全体から音楽動画を検索できます
            </li>
            <li>
              <strong>AIおすすめ</strong><br />
              登録チャンネルに基づいて新しいアーティストをAIが提案します
            </li>
          </ul>
        </div>

        <div style={{ marginTop: '32px', padding: '20px', backgroundColor: '#1a3a1a', borderRadius: '8px', border: '1px solid #4caf50' }}>
          <strong style={{ color: '#4caf50' }}>💡 ヒント：</strong>
          <p style={{ marginTop: '12px', lineHeight: '1.6' }}>
            YouTube MusicはYouTubeの一部です。YouTube Data APIを使用することで、<br />
            追加の設定なしでYouTube Musicの機能も利用できます。
          </p>
        </div>

        <div className="button-group" style={{ marginTop: '32px' }}>
          <button
            type="button"
            className="submit-button"
            onClick={() => navigate('/')}
          >
            ホームに戻る
          </button>
          <button
            type="button"
            className="cancel-button"
            onClick={() => navigate('/playlists')}
          >
            プレイリストを見る
          </button>
        </div>
      </div>
    </div>
  );
}

export default YouTubeMusicSetupPage;
