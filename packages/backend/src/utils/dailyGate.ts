import { ApiUsage } from '../models/ApiUsage.js';

function getUtcDateKey(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 1日1回だけYouTube API呼び出しを許可するためのトークン取得
 * 許可された場合 true（この呼び出しで当日分を消費）
 * 既に当日消費済みの場合 false
 */
export async function acquireYouTubeDaily(userId: string): Promise<boolean> {
  const dateKey = getUtcDateKey();
  try {
    const existing = await ApiUsage.findOne({ userId, service: 'youtube', dateKey });
    if (existing) {
      if ((existing.count || 0) >= 1) return false;
      existing.count = 1;
      existing.lastCalledAt = new Date();
      await existing.save();
      return true;
    }
    await ApiUsage.create({ userId, service: 'youtube', dateKey, count: 1, lastCalledAt: new Date() });
    return true;
  } catch {
    // 失敗時は安全側（許可しない）
    return false;
  }
}

/**
 * 当日まだ未使用かどうか（参照のみ。取得はしない）
 */
export async function isYouTubeDailyAvailable(userId: string): Promise<boolean> {
  const dateKey = getUtcDateKey();
  const existing = await ApiUsage.findOne({ userId, service: 'youtube', dateKey }).lean();
  return !existing || (existing.count || 0) < 1;
}

