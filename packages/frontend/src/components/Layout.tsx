import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path

  const handleLogout = async () => {
    await logout()
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  return (
    <div className="layout">
      {/* ハンバーガーメニューボタン */}
      <button className="menu-toggle" onClick={toggleSidebar}>
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* サイドバーオーバーレイ（モバイル） */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={closeSidebar}></div>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="logo">
          <h1>YouTube</h1>
          <p>Orchestrator</p>
        </div>
        <nav className="nav">
          <Link
            to="/"
            className={isActive('/') ? 'nav-link active' : 'nav-link'}
            onClick={closeSidebar}
          >
            ホーム
          </Link>

          <div className="nav-section">
            <div className="section-title">YouTube</div>
            <Link
              to="/youtube/playlists"
              className={location.pathname.startsWith('/youtube/playlists') ? 'nav-link active' : 'nav-link'}
              onClick={closeSidebar}
            >
              ▶️ 再生リスト
            </Link>
            <Link
              to="/channels"
              className={isActive('/channels') ? 'nav-link active' : 'nav-link'}
              onClick={closeSidebar}
            >
              📺 チャンネル
            </Link>
          </div>

          <div className="nav-section">
            <div className="section-title">YouTube Music</div>
            <Link
              to="/playlists"
              className={isActive('/playlists') ? 'nav-link active' : 'nav-link'}
              onClick={closeSidebar}
            >
              🎵 プレイリスト
            </Link>
            <Link
              to="/artists"
              className={isActive('/artists') ? 'nav-link active' : 'nav-link'}
              onClick={closeSidebar}
            >
              🎤 アーティスト
            </Link>
          </div>

          <Link
            to="/recommendations"
            className={isActive('/recommendations') ? 'nav-link active' : 'nav-link'}
            onClick={closeSidebar}
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
