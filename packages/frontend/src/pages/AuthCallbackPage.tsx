import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const error = searchParams.get('error')
    
    if (error) {
      console.error('Authentication error:', error)
      console.error('認証に失敗しました。もう一度お試しください。')
    }
    
    // Redirect to home page
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
