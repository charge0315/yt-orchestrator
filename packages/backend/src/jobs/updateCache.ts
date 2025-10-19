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
 * publishedAfterパラメータを使って新しい動画のみ取得（クォータ最適化）
 */
async function updateChannelCache(userId: string, accessToken: string) {
  try {
    const ytService = new YouTubeApiService(accessToken);
    const { CachedChannel } = await import('../models/CachedChannel.js');

    // MongoDBキャッシュから取得
    const cachedChannels = await CachedChannel.find({ userId });

    if (cachedChannels.length === 0) {
      console.log(`⚠️  No cached channels found for user ${userId}`);
      return;
    }

    let updatedCount = 0;
    for (const channel of cachedChannels) {
      try {
        // 最後の公開日時（デフォルト：7日前）
        const lastPublishedAt = channel.latestVideoPublishedAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // 差分取得：publishedAfterを使用
        const newVideos = await ytService.getChannelVideosIncremental(channel.channelId, lastPublishedAt, 5);

        if (newVideos.length > 0) {
          const latestVideo = newVideos[0];
          console.log(`📹 New video found for channel ${channel.channelTitle}: ${latestVideo.snippet?.title}`);

          // 新しい動画情報で更新
          const videoId = latestVideo.id?.videoId || (typeof latestVideo.id === 'string' ? latestVideo.id : '');
          channel.latestVideoId = videoId;
          channel.latestVideoThumbnail = latestVideo.snippet?.thumbnails?.high?.url ||
                                        latestVideo.snippet?.thumbnails?.medium?.url ||
                                        latestVideo.snippet?.thumbnails?.default?.url || undefined;
          if (latestVideo.snippet?.publishedAt) {
            channel.latestVideoPublishedAt = new Date(latestVideo.snippet.publishedAt);
          }
          channel.cachedAt = new Date();

          await channel.save();
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating channel ${channel.channelTitle}:`, error);
      }
    }

    console.log(`✅ Updated ${updatedCount}/${cachedChannels.length} channels for user ${userId} (incremental mode)`);
  } catch (error) {
    console.error('Error in updateChannelCache:', error);
  }
}

/**
 * プレイリストの差分更新
 * ETagを使って変更があった場合のみ取得（クォータ最適化）
 */
async function updatePlaylistCache(userId: string, accessToken: string) {
  try {
    const ytService = new YouTubeApiService(accessToken);
    const { CachedPlaylist } = await import('../models/CachedPlaylist.js');

    // MongoDBキャッシュから取得
    const cachedPlaylists = await CachedPlaylist.find({ userId });

    if (cachedPlaylists.length === 0) {
      console.log(`⚠️  No cached playlists found for user ${userId}`);
      return;
    }

    let updatedCount = 0;
    for (const playlist of cachedPlaylists) {
      try {
        // ETagを使った条件付きリクエスト
        const itemsResult = await ytService.getPlaylistItems(playlist.playlistId, undefined, playlist.etag);

        // 304 Not Modified（変更なし）の場合はスキップ
        if ((itemsResult as any).notModified) {
          console.log(`📊 Playlist "${playlist.title}" not modified (ETag match)`);
          continue;
        }

        // 変更があった場合のみ更新
        if (itemsResult.items.length > 0 || itemsResult.etag !== playlist.etag) {
          console.log(`📝 Playlist items changed for ${playlist.title}: ${playlist.itemCount || 0} -> ${itemsResult.items.length}`);

          playlist.itemCount = itemsResult.items.length;
          playlist.etag = itemsResult.etag || undefined; // 新しいETagを保存
          playlist.cachedAt = new Date();

          if (itemsResult.items.length > 0) {
            const thumbnailUrl = itemsResult.items[0].snippet?.thumbnails?.medium?.url;
            playlist.thumbnailUrl = thumbnailUrl || undefined;
          }

          await playlist.save();
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating playlist ${playlist.title}:`, error);
      }
    }

    console.log(`✅ Updated ${updatedCount}/${cachedPlaylists.length} playlists for user ${userId} (ETag mode)`);
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
