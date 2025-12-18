/**
 * バックグラウンドキャッシュ更新ジョブ
 * 概要:
 *  - 定期的にYouTube APIから軽量な差分情報を取得し、MongoDBキャッシュを更新します。
 *  - ユーザーごとのアクセストークンをメモリに保持し、期限切れ時は自動でリフレッシュします。
 *  - クォータ節約のため、チャンネルは publishedAfter、プレイリストは ETag を活用します。
 */
import cron from 'node-cron';
import { YouTubeApiService } from '../services/youtubeApi.js';
import { google } from 'googleapis';

// ユーザーのトークン情報をメモリに保持（セッション/DBから取得）
// 注意: プロセス再起動で消えるため、起動時にDBからプリロードします（index.ts参照）。
interface UserTokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiry?: Date; // アクセストークンの有効期限
}

const userTokens = new Map<string, UserTokenInfo>();

/**
 * ユーザートークンを登録
 * 認証完了時、またはサーバー起動時のプリロードで呼び出されます。
 */
export function registerUserToken(
  userId: string,
  accessToken: string,
  refreshToken?: string,
  expiry?: Date
) {
  userTokens.set(userId, { accessToken, refreshToken, expiry });
  console.log(`Registered token for user: ${userId}`);
}

/**
 * ユーザートークンを解除
 * ログアウト時に呼び出されます（メモリからのみ削除）。
 */
export function unregisterUserToken(userId: string) {
  if (userTokens.delete(userId)) {
    console.log(`Unregistered token for user: ${userId}`);
  }
}

/**
 * ユーザーのトークンを無効化（メモリとDBをクリア）
 * リフレッシュ不能（invalid_grantなど）を検出した場合に実行します。
 */
async function invalidateUserTokens(userId: string, reason?: string) {
  try {
    userTokens.delete(userId);
    const { User } = await import('../models/User.js');
    await User.findOneAndUpdate(
      { googleId: userId },
      {
        $unset: { youtubeAccessToken: '', youtubeRefreshToken: '', youtubeTokenExpiry: '' },
        $set: { reauthRequired: true, reauthReason: reason || 'invalid_token' }
      }
    );
    console.warn(`🚫 Invalidated tokens for user ${userId}${reason ? ` (${reason})` : ''}`);
  } catch (e) {
    console.warn('Failed to invalidate user tokens:', e);
  }
}

/**
 * 有効なアクセストークンを取得（期限切れなら自動更新）
 */
async function ensureValidAccessToken(userId: string): Promise<string | null> {
  const tokenInfo = userTokens.get(userId);
  if (!tokenInfo) return null;

  const now = Date.now();
  const safetyWindowMs = 60 * 1000; // 60秒の余裕
  const isExpired = tokenInfo.expiry ? tokenInfo.expiry.getTime() - safetyWindowMs <= now : false;

  if (!isExpired) return tokenInfo.accessToken;

  if (!tokenInfo.refreshToken) {
    console.warn(`Cannot refresh token for user ${userId}: no refresh token`);
    return tokenInfo.accessToken; // 一旦既存のトークンで継続
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.FRONTEND_URL
    );
    oauth2Client.setCredentials({ refresh_token: tokenInfo.refreshToken });

    let newAccessToken: string | null = null;
    let newExpiry: Date | undefined = undefined;
    // @ts-ignore
    if (typeof (oauth2Client as any).refreshAccessToken === 'function') {
      // @ts-ignore
      const { credentials } = await (oauth2Client as any).refreshAccessToken();
      newAccessToken = credentials.access_token || null;
      if (credentials.expiry_date) newExpiry = new Date(credentials.expiry_date);
    } else {
      const res = await oauth2Client.getAccessToken();
      newAccessToken = (typeof res === 'string' ? res : res?.token) || null;
      if (newAccessToken) newExpiry = new Date(Date.now() + 50 * 60 * 1000);
    }

    if (!newAccessToken) {
      console.warn(`Failed to refresh access token for user ${userId}`);
      return tokenInfo.accessToken;
    }

    userTokens.set(userId, {
      accessToken: newAccessToken,
      refreshToken: tokenInfo.refreshToken,
      expiry: newExpiry || tokenInfo.expiry
    });

    try {
      const { User } = await import('../models/User.js');
      await User.findOneAndUpdate(
        { googleId: userId },
        {
          $set: {
            youtubeAccessToken: newAccessToken,
            youtubeTokenExpiry: newExpiry || tokenInfo.expiry,
            reauthRequired: false
          },
          $unset: { reauthReason: '' }
        },
        { new: false }
      );
    } catch (dbErr) {
      console.warn('Failed to persist refreshed token:', dbErr);
    }

    console.log(`🔁 Refreshed access token for user ${userId}`);
    return newAccessToken;
  } catch (err) {
    const anyErr: any = err;
    const isInvalidGrant =
      anyErr?.response?.data?.error === 'invalid_grant' ||
      /invalid_grant/i.test(anyErr?.message || '');

    if (isInvalidGrant) {
      console.error(`Token refresh invalid_grant for user ${userId}. Clearing tokens.`);
      await invalidateUserTokens(userId, 'invalid_grant');
      return null;
    }

    console.error(`Token refresh error for user ${userId}:`, err);
    return tokenInfo.accessToken;
  }
}

/**
 * 新規ユーザー向けに、すべてのチャンネル登録情報を取得してキャッシュに保存する
 */
async function populateInitialChannels(userId: string, accessToken: string) {
  console.log(`✨ Populating initial channel subscriptions for new user ${userId}...`);
  const ytService = new YouTubeApiService(accessToken);
  const { CachedChannel } = await import('../models/CachedChannel.js');
  let allSubscriptions: any[] = [];
  let pageToken: string | undefined = undefined;

  try {
    do {
      const result = await ytService.getSubscriptions(pageToken);
      if (result.items) {
        allSubscriptions.push(...result.items);
      }
      pageToken = result.nextPageToken;
    } while (pageToken);

    const channelDocs = allSubscriptions.map(sub => ({
      userId,
      channelId: sub.snippet.resourceId.channelId,
      channelTitle: sub.snippet.title,
      channelDescription: sub.snippet.description,
      thumbnailUrl: sub.snippet.thumbnails.medium?.url || sub.snippet.thumbnails.default?.url,
      subscriptionId: sub.id,
      cachedAt: new Date(),
    }));

    if (channelDocs.length > 0) {
      await CachedChannel.insertMany(channelDocs, { ordered: false });
    }
    console.log(`✅ Populated ${channelDocs.length} channels for user ${userId}`);
  } catch (error) {
    console.error(`Error populating initial channels for user ${userId}:`, error);
  }
}

/**
 * 新規ユーザー向けに、すべてのプレイリスト情報を取得してキャッシュに保存する
 */
async function populateInitialPlaylists(userId: string, accessToken: string) {
  console.log(`✨ Populating initial playlists for new user ${userId}...`);
  const ytService = new YouTubeApiService(accessToken);
  const { CachedPlaylist } = await import('../models/CachedPlaylist.js');
  let allPlaylists: any[] = [];
  let pageToken: string | undefined = undefined;

  try {
    do {
      const result = await ytService.getPlaylists(pageToken);
      if (result.items) {
        allPlaylists.push(...result.items);
      }
      pageToken = result.nextPageToken;
    } while (pageToken);

    const playlistDocs = allPlaylists.map(p => ({
      userId,
      playlistId: p.id,
      title: p.snippet?.title,
      description: p.snippet?.description,
      thumbnailUrl: p.snippet?.thumbnails?.medium?.url || p.snippet?.thumbnails?.default?.url,
      itemCount: p.contentDetails?.itemCount,
      channelId: p.snippet?.channelId,
      channelTitle: p.snippet?.channelTitle,
      privacy: p.status?.privacyStatus,
      etag: p.etag,
      cachedAt: new Date(),
    }));

    if (playlistDocs.length > 0) {
      await CachedPlaylist.insertMany(playlistDocs, { ordered: false });
    }
    console.log(`✅ Populated ${playlistDocs.length} playlists for user ${userId}`);
  } catch (error) {
    console.error(`Error populating initial playlists for user ${userId}:`, error);
  }
}

/**
 * チャンネルの差分更新
 */
async function updateChannelCache(userId: string, accessToken: string, force = false) {
  try {
    const ytService = new YouTubeApiService(accessToken);
    const { CachedChannel } = await import('../models/CachedChannel.js');
    const cachedChannels = await CachedChannel.find({ userId });

    if (cachedChannels.length === 0) {
      console.log(`⚠️  No cached channels found for user ${userId} to update.`);
      return;
    }

    let updatedCount = 0;
    for (const channel of cachedChannels) {
      try {
        const lastPublishedAt = force
          ? new Date('1970-01-01T00:00:00Z')
          : channel.latestVideoPublishedAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        console.log(`[DEBUG] Fetching videos for channel: "${channel.channelTitle}" (ID: ${channel.channelId})`);
        const newVideos = await ytService.getChannelVideosIncremental(channel.channelId, lastPublishedAt, 5);
        console.log(`[DEBUG] Found ${newVideos.length} new videos for "${channel.channelTitle}".`);
        if (newVideos.length > 0) {
            console.log(`[DEBUG] Latest video title for "${channel.channelTitle}": ${newVideos[0].snippet?.title}`);
        }

        let isArtist = false;
        try {
            isArtist = await ytService.isMusicChannelAsync(channel.channelId, 5);
            console.log(`[DEBUG] Channel "${channel.channelTitle}" isArtist check: ${isArtist}`);
        } catch (e) {
            console.error(`[DEBUG] isMusicChannelAsync failed for ${channel.channelTitle}`, e);
        }

        if (newVideos.length > 0) {
          const latestVideo = newVideos[0];
          const videoId = latestVideo.id?.videoId || (typeof latestVideo.id === 'string' ? latestVideo.id : '');
          channel.latestVideoId = videoId;
          channel.latestVideoThumbnail =
            latestVideo.snippet?.thumbnails?.high?.url ||
            latestVideo.snippet?.thumbnails?.medium?.url ||
            latestVideo.snippet?.thumbnails?.default?.url ||
            undefined;
          if (latestVideo.snippet?.publishedAt) {
            channel.latestVideoPublishedAt = new Date(latestVideo.snippet.publishedAt);
          }
          channel.latestVideoTitle = latestVideo.snippet?.title ?? undefined; // 修正: null を確実に undefined に落とす
          channel.cachedAt = new Date();
          channel.isArtist = isArtist;

          console.log(`[DEBUG] SAVING channel "${channel.channelTitle}" with isArtist: ${channel.isArtist} and latestVideoTitle: ${channel.latestVideoTitle}`);
          await channel.save();
          updatedCount++;
        } else if (channel.isArtist === undefined || force) {
          channel.isArtist = isArtist;
          channel.cachedAt = new Date();
          console.log(`[DEBUG] SAVING channel "${channel.channelTitle}" with isArtist: ${channel.isArtist} (no new videos).`);
          await channel.save();
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating channel ${channel.channelTitle}:`, error);
      }
    }
    console.log(`✅ Updated ${updatedCount}/${cachedChannels.length} channels for user ${userId} (${force ? 'force' : 'incremental'} mode)`);
  } catch (error) {
    console.error('Error in updateChannelCache:', error);
  }
}

/**
 * プレイリストの差分更新
 */
async function updatePlaylistCache(userId: string, accessToken: string, force = false) {
  try {
    const ytService = new YouTubeApiService(accessToken);
    const { CachedPlaylist } = await import('../models/CachedPlaylist.js');
    const cachedPlaylists = await CachedPlaylist.find({ userId });

    if (cachedPlaylists.length === 0) {
      console.log(`⚠️  No cached playlists found for user ${userId} to update.`);
      return;
    }

    let updatedCount = 0;
    for (const playlist of cachedPlaylists) {
      try {
        const etag = force ? undefined : playlist.etag;
        const itemsResult = await ytService.getPlaylistItems(playlist.playlistId, undefined, etag);

        if ((itemsResult as any).notModified) {
          continue;
        }

        let isMusic = playlist.isMusicPlaylist;
        try {
            isMusic = await ytService.isMusicPlaylistAsync(playlist.playlistId);
            console.log(`[DEBUG] Playlist "${playlist.title}" isMusic check: ${isMusic}`);
        } catch(e) {
            console.error(`[DEBUG] isMusicPlaylistAsync failed for ${playlist.title}`, e);
        }

        if (itemsResult.items.length > 0 || itemsResult.etag !== playlist.etag || force) {
          playlist.itemCount = itemsResult.items.length;
          playlist.etag = itemsResult.etag || undefined;
          playlist.cachedAt = new Date();
          playlist.isMusicPlaylist = isMusic;

          if (itemsResult.items.length > 0) {
            const thumbnailUrl = itemsResult.items[0].snippet?.thumbnails?.medium?.url;
            playlist.thumbnailUrl = thumbnailUrl || undefined;
          }

          console.log(`[DEBUG] SAVING playlist "${playlist.title}" with isMusicPlaylist: ${playlist.isMusicPlaylist}`);
          await playlist.save();
          updatedCount++;
        } else if (playlist.isMusicPlaylist === undefined) {
          playlist.isMusicPlaylist = isMusic;
          playlist.cachedAt = new Date();
          console.log(`[DEBUG] SAVING playlist "${playlist.title}" with isMusicPlaylist: ${playlist.isMusicPlaylist} (no new items).`);
          await playlist.save();
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating playlist ${playlist.title}:`, error);
      }
    }
    console.log(`✅ Updated ${updatedCount}/${cachedPlaylists.length} playlists for user ${userId} (${force ? 'force' : 'ETag'} mode)`);
  } catch (error) {
    console.error('Error in updatePlaylistCache:', error);
  }
}

/**
 * すべてのユーザーのキャッシュを更新
 */
export async function updateAllCaches(force = false) {
  console.log(force ? '🔄 Starting force cache update...' : '🔄 Starting background cache update...');

  for (const [userId] of userTokens) {
    try {
      const accessToken = await ensureValidAccessToken(userId);
      if (!accessToken) {
        console.warn(`Skip cache update: no token for user ${userId}`);
        continue;
      }

      const { CachedChannel } = await import('../models/CachedChannel.js');
      const { CachedPlaylist } = await import('../models/CachedPlaylist.js');

      const channelCount = await CachedChannel.countDocuments({ userId });
      const playlistCount = await CachedPlaylist.countDocuments({ userId });

      if (channelCount === 0 && playlistCount === 0 && force) {
        console.log(`✨ First time setup for user ${userId}. Populating all data...`);
        await populateInitialChannels(userId, accessToken);
        await populateInitialPlaylists(userId, accessToken);
        console.log(`[DEBUG] Initial population finished. Now running update on populated cache...`);
        await updateChannelCache(userId, accessToken, true);
        await updatePlaylistCache(userId, accessToken, true);
      } else {
        await updateChannelCache(userId, accessToken, force);
        await updatePlaylistCache(userId, accessToken, force);
      }
    } catch (error) {
      console.error(`Error updating cache for user ${userId}:`, error);
    }
  }

  console.log(force ? '✅ Force cache update completed' : '✅ Background cache update completed');
}

/**
 * キャッシュ更新ジョブを開始
 */
export function startCacheUpdateJob() {
  const schedule = process.env.CACHE_UPDATE_SCHEDULE || '0 */30 * * * *';

  cron.schedule(schedule, () => {
    updateAllCaches(false);
  });

  console.log(`✅ Cache update job scheduled: ${schedule}`);

  setTimeout(() => updateAllCaches(true), 5000);
}