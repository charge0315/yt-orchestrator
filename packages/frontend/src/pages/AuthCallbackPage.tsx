/**
 * OAuth 認証コールバックページ
 * - 認証結果（クエリパラメータ）を確認し、必要ならエラーをログ出力
 * - 最終的にホームへ遷移
 */
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const error = searchParams.get('error')
    
    if (error) {
      console.error('認証エラー:', error)
      console.error('認証に失敗しました。もう一度お試しください。')
    }
    
    // ホームへ遷移
    navigate('/')
  }, [navigate, searchParams])

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h2>認証中...</h2>
      <p>しばらくお待ちください</p>
    </div>
  )
}

export default AuthCallbackPage
