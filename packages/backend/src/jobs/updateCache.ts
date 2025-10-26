/**
 * バックグラウンドキャッシュ更新ジョブ
 * 概要:
 *  - 定期的にYouTube APIから軽量な差分情報を取得し、MongoDBキャッシュを更新します。
 *  - ユーザーごとのアクセストークンをメモリに保持し、期限切れ時は自動でリフレッシュします。
 *  - クォータ節約のため、チャンネルは publishedAfter、プレイリストは ETag を活用します。
 */
import cron from 'node-cron';
import { Channel } from '../models/Channel.js';
import { Playlist } from '../models/Playlist.js';
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
 * 1) 期限未切れ: 現在のアクセストークンを返す
 * 2) 期限切れ: refresh_token があればGoogle OAuth2で再発行
 * 3) 再発行成功: メモリ＋DBを更新して返す
 * 4) invalid_grant: メモリ＋DBをクリアして null を返す
 */
async function ensureValidAccessToken(userId: string): Promise<string | null> {
  const tokenInfo = userTokens.get(userId);
  if (!tokenInfo) return null;

  const now = Date.now();
  const safetyWindowMs = 60 * 1000; // 60秒の余裕
  const isExpired = tokenInfo.expiry ? tokenInfo.expiry.getTime() - safetyWindowMs <= now : false;

  if (!isExpired) return tokenInfo.accessToken;

  // 期限切れ → リフレッシュトークンで更新を試行
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

    // googleapis の実装差異に対応し、2通りの方法でトークン取得を試行
    // 1) refreshAccessToken（存在すれば）
    let newAccessToken: string | null = null;
    let newExpiry: Date | undefined = undefined;
    // @ts-ignore
    if (typeof (oauth2Client as any).refreshAccessToken === 'function') {
      // @ts-ignore
      const { credentials } = await (oauth2Client as any).refreshAccessToken();
      newAccessToken = credentials.access_token || null;
      if (credentials.expiry_date) newExpiry = new Date(credentials.expiry_date);
    } else {
      // 2) getAccessToken（expiryは取得できない可能性あり）
      const res = await oauth2Client.getAccessToken();
      newAccessToken = (typeof res === 'string' ? res : res?.token) || null;
      // expiry未取得の場合は+50分を仮期限に設定（一般的な1時間期限から余裕を見て）
      if (newAccessToken) newExpiry = new Date(Date.now() + 50 * 60 * 1000);
    }

    if (!newAccessToken) {
      console.warn(`Failed to refresh access token for user ${userId}`);
      return tokenInfo.accessToken;
    }

    // メモリ更新
    userTokens.set(userId, {
      accessToken: newAccessToken,
      refreshToken: tokenInfo.refreshToken,
      expiry: newExpiry || tokenInfo.expiry
    });

    // DB更新（非同期で実施）
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
      return null; // 無効トークンのため処理をスキップ
    }

    console.error(`Token refresh error for user ${userId}:`, err);
    return tokenInfo.accessToken; // その他失敗時は既存トークンで継続
  }
}

/**
 * チャンネルの差分更新
 * ポイント:
 *  - 最終取得時刻（latestVideoPublishedAt）以降の動画のみ取得（publishedAfter）
 *  - 先頭の最新動画でキャッシュを更新
 *  - 可能な範囲でアーティストチャンネルかどうかを軽量判定
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

        // 差分取得：publishedAfterを使用（YouTube Data API search.list）
        const newVideos = await ytService.getChannelVideosIncremental(channel.channelId, lastPublishedAt, 5);

        // アーティスト判定（動画カテゴリID=10の割合のみで判定）
        let isArtist = false;
        try {
          isArtist = await ytService.isMusicChannelAsync(channel.channelId, 5);
        } catch {}

        if (newVideos.length > 0) {
          const latestVideo = newVideos[0];
          console.log(`📹 New video found for channel ${channel.channelTitle}: ${latestVideo.snippet?.title}`);

          // 新しい動画情報で更新（最新1件）
          const videoId = latestVideo.id?.videoId || (typeof latestVideo.id === 'string' ? latestVideo.id : '');
          channel.latestVideoId = videoId;
          channel.latestVideoThumbnail = latestVideo.snippet?.thumbnails?.high?.url ||
                                        latestVideo.snippet?.thumbnails?.medium?.url ||
                                        latestVideo.snippet?.thumbnails?.default?.url || undefined;
          if (latestVideo.snippet?.publishedAt) {
            channel.latestVideoPublishedAt = new Date(latestVideo.snippet.publishedAt);
          }
          channel.cachedAt = new Date();
          channel.isArtist = isArtist;

          await channel.save();
          updatedCount++;
        } else if (channel.isArtist === undefined) {
          // 差分がなくても初期データには isArtist がない可能性があるため補正
          channel.isArtist = isArtist;
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

          // 音楽プレイリスト判定（必要に応じて再計算）
          try {
            const isMusic = await ytService.isMusicPlaylistAsync(playlist.playlistId);
            playlist.isMusicPlaylist = isMusic;
          } catch {}

          await playlist.save();
          updatedCount++;
        }
        // isMusicPlaylist 未設定の場合は軽量に補正
        else if (playlist.isMusicPlaylist === undefined) {
          try {
            const isMusic = await ytService.isMusicPlaylistAsync(playlist.playlistId);
            playlist.isMusicPlaylist = isMusic;
            playlist.cachedAt = new Date();
            await playlist.save();
            updatedCount++;
          } catch {}
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

  for (const [userId] of userTokens) {
    try {
      const accessToken = await ensureValidAccessToken(userId);
      if (!accessToken) {
        console.warn(`Skip cache update: no token for user ${userId}`);
        continue;
      }

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
