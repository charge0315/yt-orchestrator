import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ytmusicApi } from '../api/client';
import './YouTubeMusicSetupPage.css';

function YouTubeMusicSetupPage() {
  const [cookie, setCookie] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookie.trim()) return;

    setIsSubmitting(true);
    try {
      await ytmusicApi.saveCookie(cookie);
      alert('YouTube Music連携に成功しました！');
      navigate('/playlists');
    } catch (error) {
      console.error('Failed to save YouTube Music cookie:', error);
      alert('YouTube Music連携に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ytmusic-setup-page">
      <div className="setup-container">
        <h1>🎵 YouTube Music 連携</h1>
        <p className="description">
          YouTube Musicのプレイリストを表示するには、ブラウザのCookieが必要です。
        </p>

        <div className="instructions">
          <h2>📋 Cookie取得方法（詳細手順）</h2>
          <ol>
            <li>
              <strong>YouTube Musicにアクセス</strong><br />
              <a href="https://music.youtube.com" target="_blank" rel="noopener noreferrer">
                https://music.youtube.com
              </a>
              を開いてGoogleアカウントでログイン
            </li>
            <li>
              <strong>開発者ツールを開く</strong><br />
              キーボードで <code>F12</code> を押す<br />
              または 右クリック → 「検証」を選択
            </li>
            <li>
              <strong>Applicationタブを選択</strong><br />
              開発者ツール上部のタブから「Application」を選択<br />
              （日本語版Chromeの場合は「アプリケーション」）
            </li>
            <li>
              <strong>Cookieを表示</strong><br />
              左側のメニューから「Cookies」を展開<br />
              → 「https://music.youtube.com」をクリック
            </li>
            <li>
              <strong>必要なCookieをコピー</strong><br />
              以下の4つのCookieの「Value」列をコピー：
              <ul>
                <li><code>__Secure-1PAPISID</code> の値</li>
                <li><code>__Secure-1PSID</code> の値</li>
                <li><code>__Secure-3PAPISID</code> の値</li>
                <li><code>__Secure-3PSID</code> の値</li>
              </ul>
            </li>
            <li>
              <strong>形式に整形</strong><br />
              下のテキストエリアに以下の形式で貼り付け：<br />
              <code>__Secure-1PAPISID=値1; __Secure-1PSID=値2; __Secure-3PAPISID=値3; __Secure-3PSID=値4</code>
              <br /><br />
              <strong>例：</strong><br />
              <code style={{ fontSize: '12px' }}>__Secure-1PAPISID=abc123; __Secure-1PSID=def456; __Secure-3PAPISID=ghi789; __Secure-3PSID=jkl012</code>
            </li>
          </ol>

          <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#2a3a2a', borderRadius: '8px' }}>
            <strong>💡 ヒント：</strong>
            <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
              <li>各Cookieの値は長い文字列です（通常30文字以上）</li>
              <li>セミコロン（;）とスペースで区切ってください</li>
              <li>Cookie名のスペルミスに注意してください</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="cookie-form">
          <textarea
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder="__Secure-1PAPISID=xxx; __Secure-1PSID=xxx; ..."
            rows={6}
            className="cookie-input"
            disabled={isSubmitting}
          />
          <div className="button-group">
            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting || !cookie.trim()}
            >
              {isSubmitting ? '保存中...' : '保存して連携'}
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={() => navigate('/playlists')}
              disabled={isSubmitting}
            >
              キャンセル
            </button>
          </div>
        </form>

        <div className="warning">
          ⚠️ Cookieは安全に保存されますが、定期的に更新が必要な場合があります。
        </div>
      </div>
    </div>
  );
}

export default YouTubeMusicSetupPage;
