/**
 * キャッシュエントリの型定義
 * データと有効期限のタイムスタンプを保持
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * シンプルなインメモリキャッシュ実装
 * YouTube API等の外部APIへのリクエスト回数を削減するために使用
 */
class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5分

  /**
   * キャッシュにデータを保存
   * @param key キャッシュキー
   * @param data 保存するデータ
   * @param ttl 有効期限（ミリ秒）。省略時はdefaultTTL（5分）を使用
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + (ttl || this.defaultTTL)
    });
  }

  /**
   * キャッシュからデータを取得
   * @param key キャッシュキー
   * @returns キャッシュされたデータ。存在しないか期限切れの場合はnull
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 有効期限をチェック
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * キャッシュを全てクリア
   */
  clear(): void {
    this.cache.clear();
  }
}

// シングルトンインスタンスをエクスポート
export const cache = new SimpleCache();
