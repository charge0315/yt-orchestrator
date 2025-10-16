import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import './LoginPage.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { googleLogin } = useAuth()
  const navigate = useNavigate()

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError('')
    setLoading(true)

    try {
      await googleLogin(credentialResponse.credential)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Google認証に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleError = () => {
    setError('Google認証がキャンセルされました')
  }

  // Debug: Check if Client ID is loaded
  console.log('Google Client ID:', GOOGLE_CLIENT_ID ? 'Loaded' : 'NOT LOADED');
  console.log('Client ID value:', GOOGLE_CLIENT_ID);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="error-message">
            <p>Google Client IDが設定されていません。</p>
            <p>環境変数ファイル(.env)を確認してください。</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="login-page">
        <div className="login-container">
          <div className="logo-section">
            <h1>YouTube Orchestrator</h1>
            <p className="tagline">YouTubeとYouTube Musicを統合管理するスマートツール</p>
          </div>

          <div className="features-preview">
            <div className="feature-item">
              <span className="feature-icon">🎵</span>
              <span>プレイリスト管理</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🤖</span>
              <span>AIおすすめ</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🎤</span>
              <span>アーティスト追跡</span>
            </div>
          </div>

          <div className="google-login-section">
            <p className="login-instruction">Googleアカウントでログイン</p>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              text="continue_with"
              size="large"
              width="320"
              locale="ja"
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {loading && <div className="loading-message">ログイン中...</div>}
        </div>
      </div>
    </GoogleOAuthProvider>
  )
}

export default LoginPage
