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

/**
 * YouTube Music関連の公式チャンネルID
 * これらのチャンネルから生成されたプレイリストは音楽系と判定
 */
const YOUTUBE_MUSIC_CHANNEL_IDS = [
  'UC-9-kyTW8ZkZNDHQJ6FgpwQ', // YouTube Music公式
  'UCSJ4gkVC6NrvII8umztf0Ow', // Lofi Girl
  'UCfM3zsQsOnfWNUppiycmBuw', // Music Lab
];

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
      throw new Error('YouTube access token not found');
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
      // ETagを使った条件付きリクエスト（304 Not Modified対応）
      const headers: any = {};
      if (etag) {
        headers['If-None-Match'] = etag;
      }

      const response = await this.youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        mine: true,
        maxResults: 25, // クォータ削減: 50 → 25
        pageToken,
        fields: 'etag,items(id,etag,snippet(title,description,thumbnails),contentDetails(itemCount)),nextPageToken' // etagも取得
      }, { headers });

      const result = {
        items: response.data.items || [],
        nextPageToken: response.data.nextPageToken,
        etag: response.data.etag // レスポンスのETagを保存
      };
      this.setCache(cacheKey, result);
      return result;
    } catch (error: any) {
      // 304 Not Modified の場合、変更なしなのでキャッシュを返す
      if (error?.code === 304) {
        console.log('📊 ETag match: Playlist not modified (quota saved!)');
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
    return YOUTUBE_MUSIC_CHANNEL_IDS.includes(channelId);
  }

  /**
   * プレイリストが音楽系かどうかを判定（スコアリング方式）
   * タイトルや説明に音楽関連キーワードが含まれるかチェック
   * 注: この判定は同期的で軽量ですが、完全には正確ではありません
   * より正確な判定が必要な場合は isMusicPlaylistAsync() を使用してください
   * @param playlist プレイリストオブジェクト
   * @returns 音楽系の場合true
   */
  isMusicPlaylist(playlist: any): boolean {
    const title = (playlist.snippet?.title || '').toLowerCase();
    const description = (playlist.snippet?.description || '').toLowerCase();
    const channelTitle = (playlist.snippet?.channelTitle || '').toLowerCase();
    const channelId = playlist.snippet?.channelId || '';
    const combinedText = title + ' ' + description + ' ' + channelTitle;

    let score = 0;

    // 1. チャンネルIDがYouTube Music公式チャンネルの場合（確定）
    if (YouTubeApiService.isYouTubeMusicChannel(channelId)) {
      return true;
    }

    // 2. チャンネル名に "- topic" が含まれていたら公式アーティストチャンネル（確定）
    if (channelTitle.includes('- topic')) {
      return true;
    }

    // 3. タイトルに音楽関連の絵文字が含まれている場合（スコア+2）
    if (/[🎵🎶🎸🎹🎤🎧🎼🎺🎻🥁]/u.test(title)) {
      score += 2;
    }

    // 4. 音楽関連キーワード（各キーワードでスコア+1）
    const musicKeywords = [
      'music', 'song', 'album', 'artist', 'band', 'playlist',
      '音楽', '曲', 'アルバム', 'アーティスト', 'バンド', 'プレイリスト',
      'ミュージック', 'ソング', 'bgm', 'ost', 'soundtrack',
      'jpop', 'kpop', 'rock', 'jazz', 'classical', 'pop', 'edm',
      'ボカロ', 'vocaloid', 'ボーカロイド', 'カバー', 'cover',
      'acoustic', 'live', 'concert', 'remix', 'piano', 'guitar',
      'mix', 'compilation', 'best of', 'hits'
    ];

    const musicKeywordCount = musicKeywords.filter(keyword => 
      combinedText.includes(keyword)
    ).length;
    score += Math.min(musicKeywordCount, 3); // 最大3点

    // 5. 動画関連キーワード（各キーワードでスコア-2）
    const videoKeywords = [
      'vlog', 'tutorial', 'gameplay', 'ゲーム実況', 'ゲーム',
      'game', 'review', 'レビュー', 'how to', '解説',
      'cooking', '料理', 'travel', '旅行', 'news', 'ニュース',
      'anime', 'アニメ', 'movie', '映画', 'trailer', '予告',
      'unboxing', '開封', 'haul', 'shorts', 'tiktok'
    ];

    const videoKeywordCount = videoKeywords.filter(keyword => 
      combinedText.includes(keyword)
    ).length;
    score -= videoKeywordCount * 2;

    // スコアが2以上なら音楽プレイリストと判定
    return score >= 2;
  }

  /**
   * プレイリストが音楽系かどうかを非同期で正確に判定
   * プレイリスト内の動画のカテゴリIDをチェックして判定
   * @param playlistId プレイリストID
   * @returns 音楽系の場合true（動画の50%以上がカテゴリID=10の場合）
   */
  async isMusicPlaylistAsync(playlistId: string): Promise<boolean> {
    const cacheKey = `playlist_music_check:${playlistId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached !== undefined) return cached;

    try {
      // プレイリスト内の最初の5個の動画を取得（クォータ節約）
      const playlistItems = await this.youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: playlistId,
        maxResults: 5,
        fields: 'items(snippet(resourceId/videoId,channelTitle))'
      });

      const items = playlistItems.data.items || [];
      if (items.length === 0) {
        return false;
      }

      // チャンネル名に "- Topic" が含まれているかチェック（公式アーティストチャンネル）
      const hasTopicChannel = items.some(item =>
        (item.snippet?.channelTitle || '').includes('- Topic')
      );
      if (hasTopicChannel) {
        this.setCache(cacheKey, true);
        return true;
      }

      // 動画IDを取得
      const videoIds = items
        .map(item => item.snippet?.resourceId?.videoId)
        .filter((id): id is string => !!id);

      if (videoIds.length === 0) {
        return false;
      }

      // 動画の詳細情報を取得してカテゴリIDをチェック
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet'],
        id: videoIds,
        fields: 'items(snippet/categoryId)'
      });

      const videos = videosResponse.data.items || [];

      // カテゴリID=10（Music）の動画の割合を計算
      const musicVideos = videos.filter(video => video.snippet?.categoryId === '10');
      const musicRatio = musicVideos.length / videos.length;

      // 50%以上が音楽カテゴリなら音楽プレイリストと判定
      const isMusic = musicRatio >= 0.5;

      this.setCache(cacheKey, isMusic);
      return isMusic;
    } catch (error) {
      console.error('Error checking if playlist is music:', error);
      // エラーの場合は従来のキーワードベース判定にフォールバック
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
      // 304 Not Modified の場合
      if (error?.code === 304) {
        console.log(`📊 ETag match: Playlist items not modified for ${playlistId} (quota saved!)`);
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
      console.log(`📊 Incremental fetch for channel ${channelId}: found ${items.length} new videos since ${publishedAfter.toISOString()}`);
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
    
    console.log(`Cache hit: ${key}`);
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
      console.error(`YouTube API quota exceeded in ${method}. Using cached data or returning empty result.`);
      console.error('Please wait until quota resets (daily at midnight Pacific Time) or enable billing.');
    } else {
      console.error(`Error in ${method}:`, error.message);
    }
  }
}
