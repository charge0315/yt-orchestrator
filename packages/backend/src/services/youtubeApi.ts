/**
 * YouTube Data API v3 サービスクラス
 * ユーザーのアクセストークンを使用してYouTube APIを操作する
 */
import { google, youtube_v3 } from 'googleapis';
import { GaxiosError } from 'gaxios';

// シンプルなメモリキャッシュ
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 60分（クォータ節約強化: 30分→60分）

export function clearYouTubeApiMemoryCache() {
  cache.clear();
}

/**
 * YouTube Music関連の公式チャンネルID
 * これらのチャンネルから生成されたプレイリストは音楽系と判定
 */
const YOUTUBE_MUSIC_CHANNEL_IDS = [
  'UC-9-kyTW8ZkZNDHQJ6FgpwQ', // YouTube Music公式
  'UCSJ4gkVC6NrvII8umztf0Ow', // Lofi Girl
  'UCfM3zsQsOnfWNUppiycmBuw', // Music Lab
  // 追加（プロキシ取得で確認済み）
  'UCXIyz409s7bNWVcM-vjfdVA', // Majestic Casual
  'UCJ6td3C9QlPO9O_J5dF4ZzA', // Monstercat (Monstercat Uncaged)
  'UC_aEa8K-EOJ3D6gOs7HcyNg', // NoCopyrightSounds (NCS)
];

// ランタイムで追加したいチャンネルIDを環境変数で上書き可能にする。
// 例: YOUTUBE_MUSIC_CHANNEL_IDS=UCxxxx,UCyyyy
const RUNTIME_YOUTUBE_MUSIC_CHANNEL_IDS = (process.env.YOUTUBE_MUSIC_CHANNEL_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const EFFECTIVE_YOUTUBE_MUSIC_CHANNEL_IDS = Array.from(new Set([
  ...YOUTUBE_MUSIC_CHANNEL_IDS,
  ...RUNTIME_YOUTUBE_MUSIC_CHANNEL_IDS,
]));

// 追加の判定用: チャンネル名ベースで音楽系とみなすための代表的なチャンネル名
const YOUTUBE_MUSIC_CHANNEL_TITLES = [
  'mr suicide sheep',
  'majestic casual',
  'monstercat',
  'nocopyrightsounds',
  'ncs',
  'chillhop music',
  'vevo',
];

/**
 * YouTube Data API v3 へのアクセスを提供するサービス。
 * アクセストークンを受け取り、プレイリスト/チャンネル/動画などの取得を行います。
 */
export class YouTubeApiService {
  private youtube: youtube_v3.Youtube;

  /**
   * コンストラクタ
   * @param accessToken YouTube APIアクセストークン
   */
  constructor(accessToken: string) {
    // OAuth2クライアントの設定
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.FRONTEND_URL
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    // YouTube API v3クライアントの初期化
    this.youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  }

  /**
   * アクセストークンから直接YouTubeApiServiceインスタンスを作成
   * @param accessToken YouTube APIアクセストークン
   * @returns YouTubeApiServiceインスタンス
   * @throws アクセストークンが見つからない場合
   */
  static createFromAccessToken(accessToken: string | undefined): YouTubeApiService {
    if (!accessToken) {
      throw new Error('YouTube アクセストークンが見つかりません');
    }
    return new YouTubeApiService(accessToken);
  }

  // ========================================
  // プレイリスト関連のメソッド
  // ========================================

  /**
   * ユーザーのプレイリスト一覧を取得
   * @param pageToken ページネーション用トークン（オプション）
   * @param etag 前回取得時のETag（差分確認用）
   * @returns プレイリストの配列とnextPageToken、etag
   */
  async getPlaylists(pageToken?: string, etag?: string) {
    const cacheKey = `playlists:${pageToken || 'initial'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // ETagを使った条件付きリクエスト（304: 未変更）
      const headers: any = {};
      if (etag) {
        headers['If-None-Match'] = etag;
      }

      const response = await this.youtube.playlists.list({
        part: ['snippet', 'contentDetails', 'status'], // statusを追加
        mine: true,
        maxResults: 25, // クォータ削減: 50 → 25
        pageToken,
        fields: 'etag,items(id,etag,snippet(title,description,thumbnails,channelId,channelTitle),contentDetails(itemCount),status(privacyStatus)),nextPageToken' // etagも取得
      }, { headers });

      const result = {
        items: response.data.items || [],
        nextPageToken: response.data.nextPageToken,
        etag: response.data.etag // レスポンスのETagを保存
      };
      this.setCache(cacheKey, result);
      return result;
    } catch (error: any) {
      // 304（未変更）の場合、変更なしなのでキャッシュを返す
      if (error?.code === 304) {
        console.log('📊 ETag 一致: プレイリストは未更新です（クォータ節約）');
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
      }
      this.handleApiError(error, 'getPlaylists');
      return { items: [], nextPageToken: undefined, etag: undefined };
    }
  }

  /**
   * URLドメインからYouTube Musicかどうかを判別
   * @param url プレイリストまたは動画のURL
   * @returns YouTube MusicのURLの場合true
   */
  static isYouTubeMusicUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'music.youtube.com';
    } catch {
      return false;
    }
  }

  /**
   * チャンネルIDがYouTube Music公式チャンネルかどうかを判別
   * @param channelId チャンネルID
   * @returns YouTube Music公式チャンネルの場合true
   */
  static isYouTubeMusicChannel(channelId: string): boolean {
    return EFFECTIVE_YOUTUBE_MUSIC_CHANNEL_IDS.includes(channelId);
  }

  /**
   * チャンネルが音楽系かどうかを判定（非同期・精度高）
   * 直近の動画のカテゴリID=10（Music）の割合や「- Topic」を確認
   * 結果はメモリキャッシュに保存
   */
  async isMusicChannelAsync(channelId: string, maxSamples = 5): Promise<boolean> {
    const cacheKey = `channel_music_check:${channelId}:${maxSamples}`;
    const cached = this.getFromCache(cacheKey);
    if (cached !== undefined) return cached;

    // 既知の公式チャンネルは即true
    if (YouTubeApiService.isYouTubeMusicChannel(channelId)) {
      this.setCache(cacheKey, true);
      return true;
    }

    try {
      // 直近の動画を取得
      const items = await this.getChannelVideos(channelId, maxSamples);
      if (!items || items.length === 0) {
        this.setCache(cacheKey, false);
        return false;
      }

      // チャンネル名ベースの簡易判定（代表的な音楽チャンネル名を含む場合に true）
      const firstTitle = (items[0]?.snippet?.channelTitle || '').toString().toLowerCase();
      if (firstTitle) {
        for (const t of YOUTUBE_MUSIC_CHANNEL_TITLES) {
          if (firstTitle.includes(t)) {
            this.setCache(cacheKey, true);
            return true;
          }
        }
      }

      // 「- Topic」を含むチャンネル名があればtrue
      const hasTopic = items.some((v: any) =>
        (v.snippet?.channelTitle || '').toLowerCase().includes('- topic')
      );
      if (hasTopic) {
        this.setCache(cacheKey, true);
        return true;
      }

      const videoIds = items
        .map((v: any) => (typeof v.id === 'string' ? v.id : v.id?.videoId))
        .filter((id: any): id is string => !!id);

      if (videoIds.length === 0) {
        this.setCache(cacheKey, false);
        return false;
      }

      const videosResp = await this.youtube.videos.list({
        part: ['snippet'],
        id: videoIds,
        fields: 'items(snippet/categoryId)'
      });

      const videos = videosResp.data.items || [];
      if (videos.length === 0) {
        this.setCache(cacheKey, false);
        return false;
      }

      const musicCount = videos.filter((vid) => vid.snippet?.categoryId === '10').length;
      const isMusic = musicCount > 0; // 1つでもあればtrue
      this.setCache(cacheKey, isMusic);
      return isMusic;
    } catch (e) {
      // 失敗時はfalseでフォールバック
      this.setCache(cacheKey, false);
      return false;
    }
  }

  /**
   * プレイリストが音楽系かどうかを判定（同期版）
   * キャッシュ済みのカテゴリ情報のみを使用し、Music（10）が一定割合以上なら true を返します。
   * @param playlist プレイリストオブジェクト
   * @returns 音楽系と判断できる場合は true
   */
  isMusicPlaylist(playlist: any): boolean {
    const items: any[] = Array.isArray(playlist?.items)
      ? playlist.items
      : Array.isArray(playlist?.tracks)
      ? playlist.tracks
      : [];

    const categoryIds: string[] = items
      .map((item) => {
        const snippetCategory = item?.snippet?.categoryId ?? item?.snippet?.resourceId?.categoryId;
        if (typeof snippetCategory === 'string') return snippetCategory;
        const detailCategory = item?.contentDetails?.videoCategoryId;
        return typeof detailCategory === 'string' ? detailCategory : undefined;
      })
      .filter((id): id is string => typeof id === 'string');

    if (categoryIds.length === 0) {
      return false;
    }

    const musicCount = categoryIds.filter((id) => id === '10').length;
    const musicRatio = musicCount / categoryIds.length;
    return musicRatio >= 0.1;
  }

  /**
   * プレイリストが音楽系かどうかを判定（非同期版）
   * サンプル動画を取得し、カテゴリID が Music（10）に該当する割合を見て判定します。
   * @param playlistId プレイリストID
   * @returns 音楽系と判断できる場合は true
   */
  async isMusicPlaylistAsync(playlistId: string): Promise<boolean> {
    const cacheKey = 'playlist_music_check:' + playlistId;
    const cached = this.getFromCache(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const playlistItems = await this.youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId,
        maxResults: 5,
        fields: 'items(snippet(resourceId/videoId),contentDetails/videoId)'
      });

      const items = playlistItems.data.items || [];
      if (items.length === 0) {
        this.setCache(cacheKey, false);
        return false;
      }

      const videoIds = items
        .map((item) => item.snippet?.resourceId?.videoId ?? item.contentDetails?.videoId)
        .filter((id): id is string => typeof id === 'string');

      if (videoIds.length === 0) {
        this.setCache(cacheKey, false);
        return false;
      }

      const videosResponse = await this.youtube.videos.list({
        part: ['snippet'],
        id: videoIds,
        fields: 'items(id,snippet/categoryId)'
      });

      const videos = videosResponse.data.items || [];
      if (videos.length === 0) {
        this.setCache(cacheKey, false);
        return false;
      }

      const musicCount = videos.filter((video) => video.snippet?.categoryId === '10').length;
      const isMusic = musicCount > 0; // 1つでもあればtrue
      this.setCache(cacheKey, isMusic);
      return isMusic;
    } catch (error) {
      console.error('プレイリストが音楽系かどうかの判定に失敗しました:', error);
      this.setCache(cacheKey, false);
      return false;
    }
  }

  /**
   * 特定のプレイリストを取得
   * @param playlistId プレイリストID
   * @returns プレイリスト情報
   */
  async getPlaylist(playlistId: string) {
    const response = await this.youtube.playlists.list({
      part: ['snippet', 'contentDetails'],
      id: [playlistId],
      fields: 'items(id,snippet(title,description,thumbnails),contentDetails(itemCount))' // 必要なフィールドのみ
    });
    return response.data.items?.[0];
  }

  /**
   * 新しいプレイリストを作成
   * @param title プレイリストのタイトル
   * @param description プレイリストの説明（オプション）
   * @returns 作成されたプレイリスト情報
   */
  async createPlaylist(title: string, description?: string) {
    const response = await this.youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: { title, description },
        status: { privacyStatus: 'private' } // デフォルトでプライベート
      },
      fields: 'id,snippet(title,description),status' // 必要なフィールドのみ
    });
    return response.data;
  }

  /**
   * プレイリストを更新
   * @param playlistId プレイリストID
   * @param title 新しいタイトル
   * @param description 新しい説明（オプション）
   * @returns 更新されたプレイリスト情報
   */
  async updatePlaylist(playlistId: string, title: string, description?: string) {
    const response = await this.youtube.playlists.update({
      part: ['snippet'],
      requestBody: {
        id: playlistId,
        snippet: { title, description }
      },
      fields: 'id,snippet(title,description)' // 必要なフィールドのみ
    });
    return response.data;
  }

  /**
   * プレイリストを削除
   * @param playlistId プレイリストID
   */
  async deletePlaylist(playlistId: string) {
    await this.youtube.playlists.delete({ id: playlistId });
  }

  // ========================================
  // プレイリストアイテム（曲/動画）関連のメソッド
  // ========================================

  /**
   * プレイリスト内のアイテム（曲/動画）一覧を取得
   * @param playlistId プレイリストID
   * @param pageToken ページネーション用トークン（オプション）
   * @param etag 前回取得時のETag（差分確認用）
   * @returns プレイリストアイテムの配列とnextPageToken、etag
   */
  async getPlaylistItems(playlistId: string, pageToken?: string, etag?: string) {
    try {
      // ETagを使った条件付きリクエスト
      const headers: any = {};
      if (etag) {
        headers['If-None-Match'] = etag;
      }

      const response = await this.youtube.playlistItems.list({
        part: ['snippet'], // contentDetailsは不要（videoIdはsnippet.resourceIdで取得可能）
        playlistId,
        maxResults: 25, // クォータ削減: 50 → 25
        pageToken,
        fields: 'etag,items(id,etag,snippet(title,thumbnails,resourceId,publishedAt)),nextPageToken' // etagも取得
      }, { headers });

      return {
        items: response.data.items || [],
        nextPageToken: response.data.nextPageToken,
        etag: response.data.etag
      };
    } catch (error: any) {
      // 304（未変更）の場合
      if (error?.code === 304) {
        console.log(`📊 ETag 一致: プレイリストアイテムは未更新です（${playlistId} / クォータ節約）`);
        return {
          items: [],
          nextPageToken: undefined,
          etag,
          notModified: true // 変更なしフラグ
        };
      }
      throw error;
    }
  }

  /**
   * プレイリストに動画を追加
   * @param playlistId プレイリストID
   * @param videoId 動画ID
   * @returns 追加されたプレイリストアイテム情報
   */
  async addToPlaylist(playlistId: string, videoId: string) {
    const response = await this.youtube.playlistItems.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          playlistId,
          resourceId: { kind: 'youtube#video', videoId }
        }
      },
      fields: 'id,snippet(title,resourceId)' // 必要なフィールドのみ
    });
    return response.data;
  }

  /**
   * プレイリストから動画を削除
   * @param playlistItemId プレイリストアイテムID
   */
  async removeFromPlaylist(playlistItemId: string) {
    await this.youtube.playlistItems.delete({ id: playlistItemId });
  }

  // ========================================
  // チャンネル登録（サブスクリプション）関連のメソッド
  // ========================================

  /**
   * ユーザーの登録チャンネル一覧を取得
   * @param pageToken ページネーション用トークン（オプション）
   * @returns 登録チャンネルの配列とnextPageToken
   */
  async getSubscriptions(pageToken?: string) {
    const cacheKey = `subscriptions:${pageToken || 'initial'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.youtube.subscriptions.list({
        part: ['snippet', 'contentDetails'],
        mine: true,
        maxResults: 25, // クォータ削減: 50 → 25
        pageToken,
        fields: 'items(id,snippet(title,description,thumbnails,resourceId),contentDetails),nextPageToken' // 必要なフィールドのみ
      });
      const result = {
        items: response.data.items || [],
        nextPageToken: response.data.nextPageToken
      };
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      this.handleApiError(error, 'getSubscriptions');
      return { items: [], nextPageToken: undefined };
    }
  }

  /**
   * チャンネルを登録（サブスクライブ）
   * @param channelId チャンネルID
   * @returns 登録情報
   */
  async subscribe(channelId: string) {
    const response = await this.youtube.subscriptions.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          resourceId: { kind: 'youtube#channel', channelId }
        }
      },
      fields: 'id,snippet(title,resourceId)' // 必要なフィールドのみ
    });
    return response.data;
  }

  /**
   * チャンネルの登録を解除（アンサブスクライブ）
   * @param subscriptionId サブスクリプションID
   */
  async unsubscribe(subscriptionId: string) {
    await this.youtube.subscriptions.delete({ id: subscriptionId });
  }

  // ========================================
  // 動画検索関連のメソッド
  // ========================================

  /**
   * チャンネルの動画を日付順で取得
   * @param channelId チャンネルID
   * @param maxResults 取得する最大件数（デフォルト: 5）
   * @returns 動画の配列
   */
  async getChannelVideos(channelId: string, maxResults = 5) {
    const cacheKey = `channel:${channelId}:${maxResults}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.youtube.search.list({
        part: ['snippet'],
        channelId,
        order: 'date',
        type: ['video'],
        maxResults,
        fields: 'items(id,snippet(title,thumbnails,channelTitle,publishedAt))' // 必要なフィールドのみ
      });
      const items = response.data.items || [];
      this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      this.handleApiError(error, 'getChannelVideos');
      return [];
    }
  }

  /**
   * チャンネルの新しい動画のみを取得（差分更新）
   * publishedAfterパラメータを使用してクォータを節約
   * @param channelId チャンネルID
   * @param publishedAfter この日時以降に公開された動画のみ取得
   * @param maxResults 取得する最大件数（デフォルト: 5）
   * @returns 動画の配列
   */
  async getChannelVideosIncremental(channelId: string, publishedAfter: Date, maxResults = 5) {
    try {
      const response = await this.youtube.search.list({
        part: ['snippet'],
        channelId,
        order: 'date',
        type: ['video'],
        maxResults,
        publishedAfter: publishedAfter.toISOString(), // 差分更新：この日時以降のみ
        fields: 'items(id,snippet(title,thumbnails,channelTitle,publishedAt,channelId))' // 必要なフィールドのみ
      });
      const items = response.data.items || [];
      console.log(`📊 差分取得: チャンネル ${channelId} で新規動画 ${items.length} 件（${publishedAfter.toISOString()} 以降）`);
      return items;
    } catch (error) {
      this.handleApiError(error, 'getChannelVideosIncremental');
      return [];
    }
  }

  /**
   * キーワードで動画を検索
   * @param query 検索クエリ
   * @param maxResults 取得する最大件数（デフォルト: 10）
   * @returns 動画の配列
   */
  async searchVideos(query: string, maxResults = 10) {
    const cacheKey = `search:${query}:${maxResults}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.youtube.search.list({
        part: ['snippet'],
        q: query,
        type: ['video'],
        maxResults,
        order: 'relevance',
        fields: 'items(id,snippet(title,thumbnails,channelTitle))' // 必要なフィールドのみ
      });
      const items = response.data.items || [];
      this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      this.handleApiError(error, 'searchVideos');
      return [];
    }
  }

  // ========================================
  // キャッシュとエラーハンドリング
  // ========================================

  /**
   * キャッシュから取得
   */
  private getFromCache(key: string): any | null {
    const entry = cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
      return null;
    }
    
    console.log(`キャッシュヒット: ${key}`);
    return entry.data;
  }

  /**
   * キャッシュに保存
   */
  private setCache(key: string, data: any): void {
    cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * APIエラーハンドリング
   */
  private handleApiError(error: any, method: string): void {
    if (error.code === 403) {
      console.error(`YouTube API のクォータ上限に達しました（${method}）。キャッシュを使用するか、空の結果を返します。`);
      console.error('クォータがリセットされるまで待つ（米国太平洋時間の深夜）か、課金を有効化してください。');
    } else {
      console.error(`${method} でエラーが発生しました:`, error.message);
    }
  }
}