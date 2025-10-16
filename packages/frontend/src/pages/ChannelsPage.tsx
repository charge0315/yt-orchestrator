import { useQuery } from '@tanstack/react-query'
import { channelsApi } from '../api/client'
import './ChannelsPage.css'

function ChannelsPage() {
  const { data: channels, isLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const response = await channelsApi.getAll()
      return response.data
    }
  })

  return (
    <div className="channels-page">
      <div className="page-header">
        <h1>登録チャンネル</h1>
      </div>

      {isLoading ? (
        <div>読み込み中...</div>
      ) : channels && channels.length > 0 ? (
        <div className="channels-grid">
          {channels.map((channel) => (
            <div key={channel._id} className="channel-card">
              {channel.thumbnail && (
                <img src={channel.thumbnail} alt={channel.name} />
              )}
              <div className="channel-info">
                <h3>{channel.name}</h3>
                {channel.description && <p>{channel.description}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>登録中のチャンネルはありません</p>
        </div>
      )}
    </div>
  )
}

export default ChannelsPage
