/**
 * YouTube Data API v3 サービスクラス
 * ユーザーのアクセストークンを使用してYouTube APIを操作する
 */
import { google, youtube_v3 } from 'googleapis';

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
   * @returns プレイリストの配列
   */
  async getPlaylists() {
    const response = await this.youtube.playlists.list({
      part: ['snippet', 'contentDetails'],
      mine: true, // 認証ユーザーのプレイリストのみ
      maxResults: 50
    });
    return response.data.items || [];
  }

  /**
   * プレイリストが音楽系かどうかを判定
   * タイトルや説明に音楽関連キーワードが含まれるかチェック
   * @param playlist プレイリストオブジェクト
   * @returns 音楽系の場合true
   */
  isMusicPlaylist(playlist: any): boolean {
    const title = (playlist.snippet?.title || '').toLowerCase();
    const description = (playlist.snippet?.description || '').toLowerCase();
    const combinedText = title + ' ' + description;

    // 音楽関連キーワード
    const musicKeywords = [
      'music', 'song', 'album', 'artist', 'band', 'playlist',
      '音楽', '曲', 'アルバム', 'アーティスト', 'バンド', 'プレイリスト',
      'ミュージック', 'ソング', 'bgm', 'ost', 'soundtrack',
      'jpop', 'kpop', 'rock', 'jazz', 'classical', 'pop', 'edm',
      'ボカロ', 'vocaloid', 'ボーカロイド', 'カバー', 'cover',
      'acoustic', 'live', 'concert', 'remix', 'piano', 'guitar'
    ];

    // 動画関連キーワード（これらがあると音楽ではない可能性が高い）
    const videoKeywords = [
      'vlog', 'tutorial', 'gameplay', 'ゲーム実況', 'ゲーム',
      'game', 'review', 'レビュー', 'how to', '解説',
      'cooking', '料理', 'travel', '旅行', 'news', 'ニュース',
      'anime', 'アニメ', 'movie', '映画', 'trailer', '予告'
    ];

    // 動画キーワードが含まれていたら音楽ではない
    const hasVideoKeyword = videoKeywords.some(keyword => combinedText.includes(keyword));
    if (hasVideoKeyword) {
      return false;
    }

    // 音楽キーワードが含まれていたら音楽系
    const hasMusicKeyword = musicKeywords.some(keyword => combinedText.includes(keyword));
    return hasMusicKeyword;
  }

  /**
   * 特定のプレイリストを取得
   * @param playlistId プレイリストID
   * @returns プレイリスト情報
   */
  async getPlaylist(playlistId: string) {
    const response = await this.youtube.playlists.list({
      part: ['snippet', 'contentDetails'],
      id: [playlistId]
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
      }
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
      }
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
   * @returns プレイリストアイテムの配列
   */
  async getPlaylistItems(playlistId: string) {
    const response = await this.youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId,
      maxResults: 50
    });
    return response.data.items || [];
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
      }
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
   * @returns 登録チャンネルの配列
   */
  async getSubscriptions() {
    const response = await this.youtube.subscriptions.list({
      part: ['snippet', 'contentDetails'],
      mine: true, // 認証ユーザーの登録チャンネルのみ
      maxResults: 50
    });
    return response.data.items || [];
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
      }
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
   * @param maxResults 取得する最大件数（デフォルト: 10）
   * @returns 動画の配列
   */
  async getChannelVideos(channelId: string, maxResults = 10) {
    const response = await this.youtube.search.list({
      part: ['snippet'],
      channelId,
      order: 'date', // 日付順（新しい順）
      type: ['video'], // 動画のみ（プレイリストやチャンネルを除外）
      maxResults
    });
    return response.data.items || [];
  }

  /**
   * キーワードで動画を検索
   * @param query 検索クエリ
   * @param maxResults 取得する最大件数（デフォルト: 20）
   * @returns 動画の配列
   */
  async searchVideos(query: string, maxResults = 20) {
    const response = await this.youtube.search.list({
      part: ['snippet'],
      q: query, // 検索クエリ
      type: ['video'], // 動画のみ
      maxResults,
      order: 'relevance' // 関連性順
    });
    return response.data.items || [];
  }
}
