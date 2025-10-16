import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { youtubeOAuthApi } from '../api/client'

function YouTubeCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get authorization code from URL
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')

        if (error) {
          setStatus('error')
          setError(`認証がキャンセルされました: ${error}`)
          setTimeout(() => navigate('/playlists'), 3000)
          return
        }

        if (!code) {
          setStatus('error')
          setError('認証コードが見つかりません')
          setTimeout(() => navigate('/playlists'), 3000)
          return
        }

        // Send code to backend
        await youtubeOAuthApi.handleCallback(code)

        setStatus('success')
        setTimeout(() => navigate('/playlists'), 2000)
      } catch (err: any) {
        console.error('YouTube callback error:', err)
        setStatus('error')
        setError(err.response?.data?.error || 'YouTube連携に失敗しました')
        setTimeout(() => navigate('/playlists'), 3000)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px'
    }}>
      {status === 'processing' && (
        <>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          <h2>YouTube連携中...</h2>
          <p>しばらくお待ちください</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
          <h2>YouTube連携が完了しました！</h2>
          <p>プレイリストページにリダイレクトします...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h2>エラーが発生しました</h2>
          <p>{error}</p>
          <p>プレイリストページにリダイレクトします...</p>
        </>
      )}
    </div>
  )
}

export default YouTubeCallbackPage
