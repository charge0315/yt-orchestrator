/**
 * ミニプレイヤーコンポーネント
 * 右下に16:9の小さい再生画面を表示する
 */
import { useState } from 'react'
import './MiniPlayer.css'

interface MiniPlayerProps {
  videoId: string | null
  playlistId?: string | null
  videoTitle?: string
  onClose: () => void
}

function MiniPlayer({ videoId, playlistId, videoTitle, onClose }: MiniPlayerProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  if (!videoId && !playlistId) return null

  // プレイリストIDがある場合はプレイリスト形式のURLを生成
  const embedUrl = playlistId
    ? `https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1&rel=0`
    : `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`

  return (
    <div className={`mini-player ${isMinimized ? 'minimized' : ''}`}>
      <div className="mini-player-header">
        <h4 className="mini-player-title">{videoTitle || '再生中'}</h4>
        <div className="mini-player-controls">
          <button
            className="mini-player-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? '展開' : '最小化'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          <button
            className="mini-player-btn"
            onClick={onClose}
            title="閉じる"
          >
            ✕
          </button>
        </div>
      </div>
      {!isMinimized && (
        <div className="mini-player-video">
          <iframe
            src={embedUrl}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}

export default MiniPlayer
