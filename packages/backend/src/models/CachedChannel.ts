/**
 * キャッシュされたチャンネル情報モデル
 * YouTube API呼び出しを削減するためにチャンネル情報をキャッシュ
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface ICachedChannel extends Document {
  userId: string; // Google ID
  channelId: string;
  channelTitle: string;
  channelDescription?: string;
  thumbnailUrl?: string;
  customUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
  latestVideoId?: string;
  latestVideoThumbnail?: string;
  latestVideoTitle?: string;
  latestVideoPublishedAt?: Date; // 最新動画の公開日時（差分更新用）
  subscriptionId?: string; // YouTube subscription ID
  etag?: string; // ETag for conditional requests（差分更新用）
  cachedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CachedChannelSchema = new Schema<ICachedChannel>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    channelId: {
      type: String,
      required: true
    },
    channelTitle: {
      type: String,
      required: true
    },
    channelDescription: String,
    thumbnailUrl: String,
    customUrl: String,
    subscriberCount: Number,
    videoCount: Number,
    latestVideoId: String,
    latestVideoThumbnail: String,
    latestVideoTitle: String,
    latestVideoPublishedAt: Date,
    subscriptionId: String,
    etag: String,
    cachedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// ユーザーごとのチャンネルは一意
CachedChannelSchema.index({ userId: 1, channelId: 1 }, { unique: true });

export const CachedChannel = mongoose.model<ICachedChannel>('CachedChannel', CachedChannelSchema);
