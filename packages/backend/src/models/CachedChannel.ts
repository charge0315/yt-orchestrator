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
  subscriptionId?: string; // YouTube subscription ID
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
    subscriptionId: String,
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
