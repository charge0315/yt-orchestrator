/**
 * バックグラウンドキャッシュ更新ジョブ
 * 定期的にYouTube APIからデータを取得してDBに保存
 */
import cron from 'node-cron';
import { Channel } from '../models/Channel.js';
import { Playlist } from '../models/Playlist.js';
import { YouTubeApiService } from '../services/youtubeApi.js';

// ユーザーのアクセストークンをメモリに保持（セッションから取得）
const userTokens = new Map<string, string>();

/**
 * ユーザートークンを登録
 */
export function registerUserToken(userId: string, accessToken: string) {
  userTokens.set(userId, accessToken);
  console.log(`Registered token for user: ${userId}`);
}

/**
 * チャンネルの差分更新
 * pageTokenを使って新しい動画のみ取得
 */
async function updateChannelCache(userId: string, accessToken: string) {
  try {
    const ytService = new YouTubeApiService(accessToken);

    // ユーザーのチャンネル一覧をDBから取得
    const channels = await Channel.find({ userId });

    for (const channel of channels) {
      try {
        // 最新動画を取得（最大5件）
        const videos = await ytService.getChannelVideos(channel.channelId, 5);

        if (videos.length > 0) {
          const latestVideo = videos[0];

          // DBの最新動画と比較して、新しい動画がある場合のみ更新
          const dbLatestVideoId = channel.latestVideoId;
          const apiLatestVideoId = latestVideo.id?.videoId || latestVideo.id;

          if (dbLatestVideoId !== apiLatestVideoId) {
            console.log(`New video found for channel ${channel.title}: ${latestVideo.snippet?.title}`);

            // 新しい動画情報で更新
            channel.latestVideos = videos.map((video: any) => ({
              videoId: video.id?.videoId || video.id,
              title: video.snippet?.title || '',
              thumbnail: video.snippet?.thumbnails?.medium?.url || '',
              publishedAt: new Date(video.snippet?.publishedAt),
              channelId: video.snippet?.channelId || '',
              channelTitle: video.snippet?.channelTitle || ''
            }));

            channel.latestVideoId = apiLatestVideoId;
            channel.latestVideoThumbnail = latestVideo.snippet?.thumbnails?.high?.url ||
                                          latestVideo.snippet?.thumbnails?.medium?.url ||
                                          latestVideo.snippet?.thumbnails?.default?.url;
            channel.lastUpdated = new Date();

            await channel.save();
          }
        }
      } catch (error) {
        console.error(`Error updating channel ${channel.title}:`, error);
      }
    }

    console.log(`✅ Updated ${channels.length} channels for user ${userId}`);
  } catch (error) {
    console.error('Error in updateChannelCache:', error);
  }
}

/**
 * プレイリストの差分更新
 * pageTokenを使って新しいアイテムのみ取得
 */
async function updatePlaylistCache(userId: string, accessToken: string) {
  try {
    const ytService = new YouTubeApiService(accessToken);

    // ユーザーのプレイリスト一覧をDBから取得
    const playlists = await Playlist.find({ userId });

    for (const playlist of playlists) {
      try {
        // プレイリストアイテムを取得
        const itemsResult = await ytService.getPlaylistItems(playlist.playlistId);

        // DBのアイテム数とAPI のアイテム数を比較
        if (itemsResult.items.length !== playlist.items.length) {
          console.log(`Playlist items changed for ${playlist.title}: ${playlist.items.length} -> ${itemsResult.items.length}`);

          // アイテム情報を更新
          playlist.items = itemsResult.items.map((item: any, index: number) => ({
            videoId: item.snippet?.resourceId?.videoId || '',
            title: item.snippet?.title || '',
            thumbnail: item.snippet?.thumbnails?.medium?.url || '',
            addedAt: new Date(item.snippet?.publishedAt),
            position: index
          }));

          playlist.itemCount = itemsResult.items.length;
          playlist.lastUpdated = new Date();

          if (itemsResult.items.length > 0) {
            playlist.thumbnail = itemsResult.items[0].snippet?.thumbnails?.medium?.url || '';
          }

          await playlist.save();
        }
      } catch (error) {
        console.error(`Error updating playlist ${playlist.title}:`, error);
      }
    }

    console.log(`✅ Updated ${playlists.length} playlists for user ${userId}`);
  } catch (error) {
    console.error('Error in updatePlaylistCache:', error);
  }
}

/**
 * すべてのユーザーのキャッシュを更新
 */
async function updateAllCaches() {
  console.log('🔄 Starting background cache update...');

  for (const [userId, accessToken] of userTokens) {
    try {
      await updateChannelCache(userId, accessToken);
      await updatePlaylistCache(userId, accessToken);
    } catch (error) {
      console.error(`Error updating cache for user ${userId}:`, error);
    }
  }

  console.log('✅ Background cache update completed');
}

/**
 * キャッシュ更新ジョブを開始
 * デフォルト: 30分ごとに実行
 */
export function startCacheUpdateJob() {
  // 30分ごとに実行 (0 */30 * * * *)
  // テスト用に5分ごとに変更可能 (*/5 * * * *)
  const schedule = process.env.CACHE_UPDATE_SCHEDULE || '0 */30 * * * *';

  cron.schedule(schedule, () => {
    updateAllCaches();
  });

  console.log(`✅ Cache update job scheduled: ${schedule}`);

  // 起動時に即座に1回実行
  setTimeout(() => updateAllCaches(), 5000); // 5秒後に初回実行
}
