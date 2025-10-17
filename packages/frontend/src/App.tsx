import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import PlaylistsPage from './pages/PlaylistsPage'
import PlaylistDetailPage from './pages/PlaylistDetailPage'
import YouTubePlaylistDetailPage from './pages/YouTubePlaylistDetailPage'
import ArtistsPage from './pages/ArtistsPage'
import ChannelsPage from './pages/ChannelsPage'
import RecommendationsPage from './pages/RecommendationsPage'
import YouTubePlaylistsPage from './pages/YouTubePlaylistsPage'
import YouTubeCallbackPage from './pages/YouTubeCallbackPage'
import YouTubeMusicSetupPage from './pages/YouTubeMusicSetupPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import LoginPage from './pages/LoginPage'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: '#ffffff'
      }}>
        読み込み中...
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/playlists" element={<PlaylistsPage />} />
        <Route path="/playlists/:id" element={<YouTubePlaylistDetailPage />} />
        <Route path="/playlists-old/:id" element={<PlaylistDetailPage />} />
        <Route path="/artists" element={<ArtistsPage />} />
        <Route path="/channels" element={<ChannelsPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/youtube/playlists" element={<YouTubePlaylistsPage />} />
        <Route path="/youtube/playlists/:id" element={<YouTubePlaylistDetailPage />} />
        <Route path="/youtube/callback" element={<YouTubeCallbackPage />} />
        <Route path="/ytmusic/setup" element={<YouTubeMusicSetupPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
