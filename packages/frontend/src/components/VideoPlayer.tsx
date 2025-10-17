/**
 * 動画プレイヤーモーダルコンポーネント
 * YouTube動画を埋め込みで再生する
 */
import { useEffect, useRef } from 'react'
import './VideoPlayer.css'

interface VideoPlayerProps {
  videoId: string | null
  onClose: () => void
}

function VideoPlayer({ videoId, onClose }: VideoPlayerProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Escキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (videoId) {
      document.addEventListener('keydown', handleKeyDown)
      // スクロールを無効化
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // スクロールを有効化
      document.body.style.overflow = 'auto'
    }
  }, [videoId, onClose])

  // モーダル外クリックで閉じる
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose()
    }
  }

  if (!videoId) return null

  return (
    <div
      className="video-player-backdrop"
      ref={modalRef}
      onClick={handleBackdropClick}
    >
      <div className="video-player-modal">
        <button className="video-player-close" onClick={onClose}>
          ✕
        </button>
        <div className="video-player-container">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}

export default VideoPlayer
