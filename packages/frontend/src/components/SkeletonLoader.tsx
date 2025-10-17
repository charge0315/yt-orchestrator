/**
 * スケルトンローディングコンポーネント
 * データ読み込み中に表示される
 */
import './SkeletonLoader.css'

interface SkeletonLoaderProps {
  type?: 'card' | 'video' | 'text' | 'circle'
  count?: number
  height?: string
  width?: string
}

function SkeletonLoader({ type = 'card', count = 1, height, width }: SkeletonLoaderProps) {
  const items = Array.from({ length: count }, (_, i) => i)

  if (type === 'card') {
    return (
      <div className="skeleton-container">
        {items.map((i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-image skeleton-shimmer" />
            <div className="skeleton-text skeleton-shimmer" style={{ width: '80%', marginTop: '8px' }} />
            <div className="skeleton-text skeleton-shimmer" style={{ width: '60%', marginTop: '4px' }} />
          </div>
        ))}
      </div>
    )
  }

  if (type === 'video') {
    return (
      <div className="skeleton-container">
        {items.map((i) => (
          <div key={i} className="skeleton-video">
            <div className="skeleton-video-thumbnail skeleton-shimmer" />
            <div className="skeleton-text skeleton-shimmer" style={{ width: '90%', marginTop: '12px' }} />
            <div className="skeleton-text skeleton-shimmer" style={{ width: '70%', marginTop: '4px' }} />
          </div>
        ))}
      </div>
    )
  }

  if (type === 'circle') {
    return (
      <div className="skeleton-container">
        {items.map((i) => (
          <div key={i} className="skeleton-circle skeleton-shimmer" style={{ width, height }} />
        ))}
      </div>
    )
  }

  // text type
  return (
    <div className="skeleton-container">
      {items.map((i) => (
        <div key={i} className="skeleton-text skeleton-shimmer" style={{ width, height }} />
      ))}
    </div>
  )
}

export default SkeletonLoader
