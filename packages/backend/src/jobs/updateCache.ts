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
import mongoose from 'mongoose';
import { clearYouTubeApiMemoryCache } from '../services/youtubeApi.js';

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
  console.log(`ユーザーのトークンを登録しました: ${userId}`);
}

/**
 * ユーザートークンを解除
 * ログアウト時に呼び出されます（メモリからのみ削除）。
 */
export function unregisterUserToken(userId: string) {
  if (userTokens.delete(userId)) {
    console.log(`ユーザーのトークンを解除しました: ${userId}`);
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
    console.warn(`🚫 ユーザー ${userId} のトークンを無効化しました${reason ? `（${reason}）` : ''}`);
  } catch (e) {
    console.warn('ユーザートークンの無効化に失敗しました:', e);
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
    console.warn(`ユーザー ${userId} のトークンを更新できません（リフレッシュトークンなし）`);
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
      console.warn(`ユーザー ${userId} のアクセストークン更新に失敗しました`);
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
      console.warn('更新したトークンのDB保存に失敗しました:', dbErr);
    }

    console.log(`🔁 ユーザー ${userId} のアクセストークンを更新しました`);
    return newAccessToken;
  } catch (err) {
    const anyErr: any = err;
    const isInvalidGrant =
      anyErr?.response?.data?.error === 'invalid_grant' ||
      /invalid_grant/i.test(anyErr?.message || '');

    if (isInvalidGrant) {
      console.error(`ユーザー ${userId} のトークン更新で invalid_grant。トークンをクリアします。`);
      await invalidateUserTokens(userId, 'invalid_grant');
      return null;
    }

    console.error(`ユーザー ${userId} のトークン更新エラー:`, err);
    return tokenInfo.accessToken;
  }
}

/**
 * 新規ユーザー向けに、すべてのチャンネル登録情報を取得してキャッシュに保存する
 */
async function populateInitialChannels(userId: string, accessToken: string) {
  console.log(`✨ 新規ユーザー ${userId} のチャンネル登録を初期取得します...`);
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
    console.log(`✅ ユーザー ${userId} に ${channelDocs.length} 件のチャンネルを投入しました`);
  } catch (error) {
    console.error(`ユーザー ${userId} の初期チャンネル投入エラー:`, error);
  }
}

/**
 * 新規ユーザー向けに、すべてのプレイリスト情報を取得してキャッシュに保存する
 */
async function populateInitialPlaylists(userId: string, accessToken: string) {
  console.log(`✨ 新規ユーザー ${userId} のプレイリストを初期取得します...`);
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
    console.log(`✅ ユーザー ${userId} に ${playlistDocs.length} 件のプレイリストを投入しました`);
  } catch (error) {
    console.error(`ユーザー ${userId} の初期プレイリスト投入エラー:`, error);
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
      console.log(`⚠️  ユーザー ${userId} に更新対象のキャッシュチャンネルがありません。`);
      return;
    }

    let updatedCount = 0;
    for (const channel of cachedChannels) {
      try {
        const lastPublishedAt = force
          ? new Date('1970-01-01T00:00:00Z')
          : channel.latestVideoPublishedAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        console.log(`[DEBUG] チャンネルの動画を取得中: "${channel.channelTitle}" (ID: ${channel.channelId})`);
        const newVideos = await ytService.getChannelVideosIncremental(channel.channelId, lastPublishedAt, 5);
        console.log(`[DEBUG] "${channel.channelTitle}" の新規動画: ${newVideos.length} 件`);
        if (newVideos.length > 0) {
          console.log(`[DEBUG] "${channel.channelTitle}" の最新動画タイトル: ${newVideos[0].snippet?.title}`);
        }

        let isArtist = false;
        try {
            isArtist = await ytService.isMusicChannelAsync(channel.channelId, 5);
          console.log(`[DEBUG] "${channel.channelTitle}" の isArtist 判定: ${isArtist}`);
        } catch (e) {
          console.error(`[DEBUG] isMusicChannelAsync 失敗: ${channel.channelTitle}`, e);
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

          console.log(`[DEBUG] チャンネル保存: "${channel.channelTitle}" / isArtist=${channel.isArtist} / latestVideoTitle=${channel.latestVideoTitle}`);
          await channel.save();
          updatedCount++;
        } else if (channel.isArtist === undefined || force) {
          channel.isArtist = isArtist;
          channel.cachedAt = new Date();
          console.log(`[DEBUG] チャンネル保存: "${channel.channelTitle}" / isArtist=${channel.isArtist}（新規動画なし）`);
          await channel.save();
          updatedCount++;
        }
      } catch (error) {
        console.error(`チャンネル更新エラー (${channel.channelTitle}):`, error);
      }
    }
    console.log(`✅ ユーザー ${userId} のチャンネルを更新しました: ${updatedCount}/${cachedChannels.length}（${force ? '強制' : '差分'}モード）`);
  } catch (error) {
    console.error('updateChannelCache のエラー:', error);
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
      console.log(`⚠️  ユーザー ${userId} に更新対象のキャッシュプレイリストがありません。`);
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
          console.log(`[DEBUG] プレイリスト "${playlist.title}" の isMusic 判定: ${isMusic}`);
        } catch(e) {
          console.error(`[DEBUG] isMusicPlaylistAsync 失敗: ${playlist.title}`, e);
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

          console.log(`[DEBUG] プレイリスト保存: "${playlist.title}" / isMusicPlaylist=${playlist.isMusicPlaylist}`);
          await playlist.save();
          updatedCount++;
        } else if (playlist.isMusicPlaylist === undefined) {
          playlist.isMusicPlaylist = isMusic;
          playlist.cachedAt = new Date();
          console.log(`[DEBUG] プレイリスト保存: "${playlist.title}" / isMusicPlaylist=${playlist.isMusicPlaylist}（新規アイテムなし）`);
          await playlist.save();
          updatedCount++;
        }
      } catch (error) {
        console.error(`プレイリスト更新エラー (${playlist.title}):`, error);
      }
    }
    console.log(`✅ ユーザー ${userId} のプレイリストを更新しました: ${updatedCount}/${cachedPlaylists.length}（${force ? '強制' : 'ETag'}モード）`);
  } catch (error) {
    console.error('updatePlaylistCache のエラー:', error);
  }
}

/**
 * すべてのユーザーのキャッシュを更新
 */
export async function updateAllCaches(force = false) {
  console.log(force ? '🔄 強制キャッシュ更新を開始...' : '🔄 バックグラウンドキャッシュ更新を開始...');

  for (const [userId] of userTokens) {
    try {
      const accessToken = await ensureValidAccessToken(userId);
      if (!accessToken) {
        console.warn(`ユーザー ${userId} のキャッシュ更新をスキップ（トークンなし）`);
        continue;
      }

      const { CachedChannel } = await import('../models/CachedChannel.js');
      const { CachedPlaylist } = await import('../models/CachedPlaylist.js');

      const channelCount = await CachedChannel.countDocuments({ userId });
      const playlistCount = await CachedPlaylist.countDocuments({ userId });

      if (channelCount === 0 && playlistCount === 0 && force) {
        console.log(`✨ ユーザー ${userId} 初回セットアップ: 全データを投入します...`);
        await populateInitialChannels(userId, accessToken);
        await populateInitialPlaylists(userId, accessToken);
        console.log('[DEBUG] 初期投入が完了。投入済みキャッシュに対して更新処理を実行します...');
        await updateChannelCache(userId, accessToken, true);
        await updatePlaylistCache(userId, accessToken, true);
      } else {
        await updateChannelCache(userId, accessToken, force);
        await updatePlaylistCache(userId, accessToken, force);
      }
    } catch (error) {
      console.error(`ユーザー ${userId} のキャッシュ更新エラー:`, error);
    }
  }

  console.log(force ? '✅ 強制キャッシュ更新が完了しました' : '✅ バックグラウンドキャッシュ更新が完了しました');
}

/**
 * 指定ユーザーのキャッシュのみ更新（初回投入 + isArtist/isMusicPlaylist 判定含む）
 * - ログイン直後の初回表示や、空キャッシュの救済用途
 */
export async function updateUserCaches(userId: string, force = false): Promise<boolean> {
  try {
    const accessToken = await ensureValidAccessToken(userId);
    if (!accessToken) {
      console.warn(`ユーザー ${userId} のキャッシュ更新をスキップ（トークンなし）`);
      return false;
    }

    const { CachedChannel } = await import('../models/CachedChannel.js');
    const { CachedPlaylist } = await import('../models/CachedPlaylist.js');

    const channelCount = await CachedChannel.countDocuments({ userId });
    const playlistCount = await CachedPlaylist.countDocuments({ userId });

    if (channelCount === 0 && playlistCount === 0 && force) {
      console.log(`✨ ユーザー ${userId} 初回セットアップ: 全データを投入します...`);
      await populateInitialChannels(userId, accessToken);
      await populateInitialPlaylists(userId, accessToken);
      console.log('[DEBUG] 初期投入が完了。投入済みキャッシュに対して更新処理を実行します...');
      await updateChannelCache(userId, accessToken, true);
      await updatePlaylistCache(userId, accessToken, true);
      return true;
    }

    await updateChannelCache(userId, accessToken, force);
    await updatePlaylistCache(userId, accessToken, force);
    return true;
  } catch (error) {
    console.error(`ユーザー ${userId} のキャッシュ更新エラー:`, error);
    return false;
  }
}

export type RefreshUserCacheResult =
  | {
      ok: true;
      userId: string;
      deleted: { channels: number; playlists: number };
      repopulated: { channels: number; playlists: number };
      updatedAt: string;
    }
  | { ok: false; userId: string; error: string };

/**
 * 指定ユーザーの MongoDB キャッシュをクリアして、YouTube API から強制的に再同期します。
 * - CachedChannel / CachedPlaylist を削除
 * - 初期投入（subscriptions/playlists）
 * - 強制更新（最新動画/音楽判定/ETag など）
 */
export async function refreshUserCache(userId: string): Promise<RefreshUserCacheResult> {
  if (!userId) return { ok: false, userId: '', error: 'missing_user_id' };

  if (mongoose.connection.readyState !== 1) {
    return { ok: false, userId, error: 'mongodb_not_connected' };
  }

  const accessToken = await ensureValidAccessToken(userId);
  if (!accessToken) {
    return { ok: false, userId, error: 'no_access_token' };
  }

  try {
    clearYouTubeApiMemoryCache();
  } catch {}

  try {
    const { CachedChannel } = await import('../models/CachedChannel.js');
    const { CachedPlaylist } = await import('../models/CachedPlaylist.js');

    const deleteChannelsRes = await CachedChannel.deleteMany({ userId });
    const deletePlaylistsRes = await CachedPlaylist.deleteMany({ userId });

    await populateInitialChannels(userId, accessToken);
    await populateInitialPlaylists(userId, accessToken);

    const repopulatedChannels = await CachedChannel.countDocuments({ userId });
    const repopulatedPlaylists = await CachedPlaylist.countDocuments({ userId });

    await updateChannelCache(userId, accessToken, true);
    await updatePlaylistCache(userId, accessToken, true);

    return {
      ok: true,
      userId,
      deleted: {
        channels: deleteChannelsRes.deletedCount || 0,
        playlists: deletePlaylistsRes.deletedCount || 0,
      },
      repopulated: {
        channels: repopulatedChannels,
        playlists: repopulatedPlaylists,
      },
      updatedAt: new Date().toISOString(),
    };
  } catch (e: any) {
    return { ok: false, userId, error: e?.message || 'refresh_failed' };
  }
}

/**
 * キャッシュ更新ジョブを開始
 */
export function startCacheUpdateJob() {
  const schedule = process.env.CACHE_UPDATE_SCHEDULE || '0 */30 * * * *';

  cron.schedule(schedule, () => {
    updateAllCaches(false);
  });

  console.log(`✅ キャッシュ更新ジョブをスケジュールしました: ${schedule}`);

  // 起動時の自動実行はクォータを消費しやすいので、明示的に opt-in とする
  // - RUN_CACHE_UPDATE_ON_STARTUP=true で起動時に実行
  // - FORCE_CACHE_UPDATE_ON_STARTUP=true なら強制モード（より重い）
  if (process.env.RUN_CACHE_UPDATE_ON_STARTUP === 'true') {
    const force = process.env.FORCE_CACHE_UPDATE_ON_STARTUP === 'true';
    setTimeout(() => updateAllCaches(force), 5000);
  }
}