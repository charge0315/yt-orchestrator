/**
 * ローカルにキャッシュされたプレイリスト（MongoDB経由）を1件表示する詳細ページ。
 *
 * - 取得: `playlistsApi.getById`
 * - 再生: `VideoPlayer` をモーダル表示
 * - 削除: `playlistsApi.removeSong` 後にクエリをinvalidate
 */
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { playlistsApi } from '../api/client'
import VideoPlayer from '../components/VideoPlayer'
import './PlaylistDetailPage.css'

/**
 * プレイリスト詳細画面。
 * URLパラメータ `id` を元に、曲一覧の表示と削除・再生を行う。
 */
function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)

  const { data: playlist, isLoading } = useQuery({
    queryKey: ['playlist', id],
    queryFn: async () => {
      const response = await playlistsApi.getById(id!)
      return response.data
    },
    enabled: !!id
  })

  const removeSongMutation = useMutation({
    mutationFn: (videoId: string) => playlistsApi.removeSong(id!, videoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', id] })
    }
  })

  if (isLoading) return <div>読み込み中...</div>
  if (!playlist) return <div>プレイリストが見つかりません</div>

  return (
    <div className="playlist-detail-page">
      {/* 動画プレイヤーモーダル */}
      <VideoPlayer videoId={playingVideoId} onClose={() => setPlayingVideoId(null)} />

      <Link to="/playlists" className="back-link">
        ← プレイリスト一覧に戻る
      </Link>

      <div className="playlist-header">
        <h1>{playlist.name}</h1>
        {playlist.description && <p className="description">{playlist.description}</p>}
        <div className="stats">
          <span>{playlist.songs.length} 曲</span>
        </div>
      </div>

      {playlist.songs.length === 0 ? (
        <div className="empty-state">
          <p>このプレイリストには曲がありません</p>
        </div>
      ) : (
        <div className="songs-list">
          {playlist.songs.map((song, index) => (
            <div key={song.videoId + index} className="song-item">
              <div className="song-number">{index + 1}</div>
              {song.thumbnail && (
                <img
                  src={song.thumbnail}
                  alt={song.title}
                  className="song-thumbnail clickable"
                  onClick={() => setPlayingVideoId(song.videoId)}
                  style={{ cursor: 'pointer' }}
                />
              )}
              <div className="song-info" onClick={() => setPlayingVideoId(song.videoId)} style={{ cursor: 'pointer' }}>
                <div className="song-title">{song.title}</div>
                <div className="song-artist">{song.artist}</div>
              </div>
              {song.duration && (
                <div className="song-duration">{song.duration}</div>
              )}
              <button
                className="play-button"
                onClick={() => setPlayingVideoId(song.videoId)}
                title="再生"
              >
                ▶️
              </button>
              <button
                className="remove-button"
                onClick={() => removeSongMutation.mutate(song.videoId)}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PlaylistDetailPage
