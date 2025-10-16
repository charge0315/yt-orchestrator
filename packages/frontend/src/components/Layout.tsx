import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { user, logout } = useAuth()

  const isActive = (path: string) => location.pathname === path

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <h1>YouTube</h1>
          <p>Orchestrator</p>
        </div>
        <nav className="nav">
          <Link
            to="/"
            className={isActive('/') ? 'nav-link active' : 'nav-link'}
          >
            ホーム
          </Link>

          <div className="nav-section">
            <div className="section-title">YouTube Music</div>
            <Link
              to="/playlists"
              className={isActive('/playlists') ? 'nav-link active' : 'nav-link'}
            >
              🎵 プレイリスト
            </Link>
            <Link
              to="/artists"
              className={isActive('/artists') ? 'nav-link active' : 'nav-link'}
            >
              🎤 アーティスト
            </Link>
          </div>

          <div className="nav-section">
            <div className="section-title">YouTube</div>
            <Link
              to="/youtube/playlists"
              className={location.pathname.startsWith('/youtube/playlists') ? 'nav-link active' : 'nav-link'}
            >
              ▶️ 再生リスト
            </Link>
            <Link
              to="/channels"
              className={isActive('/channels') ? 'nav-link active' : 'nav-link'}
            >
              📺 チャンネル
            </Link>
          </div>

          <Link
            to="/recommendations"
            className={isActive('/recommendations') ? 'nav-link active' : 'nav-link'}
          >
            🤖 AIおすすめ
          </Link>
        </nav>
        <div className="user-section">
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  )
}

export default Layout
