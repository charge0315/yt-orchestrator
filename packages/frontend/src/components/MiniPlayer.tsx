/**
 * ミニプレイヤーコンポーネント
 * 右下に16:9の小さい再生画面を表示する
 */
import { useState } from 'react'
import './MiniPlayer.css'

interface MiniPlayerProps {
  videoId: string | null
  videoTitle?: string
  onClose: () => void
}

function MiniPlayer({ videoId, videoTitle, onClose }: MiniPlayerProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  if (!videoId) return null

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
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
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
