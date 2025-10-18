/**
 * キャッシュされたプレイリスト情報モデル
 * YouTube API呼び出しを削減するためにプレイリスト情報をキャッシュ
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface ICachedPlaylist extends Document {
  userId: string; // Google ID
  playlistId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  itemCount?: number;
  channelId?: string;
  channelTitle?: string;
  privacy?: 'public' | 'private' | 'unlisted';
  cachedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CachedPlaylistSchema = new Schema<ICachedPlaylist>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    playlistId: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: String,
    thumbnailUrl: String,
    itemCount: Number,
    channelId: String,
    channelTitle: String,
    privacy: {
      type: String,
      enum: ['public', 'private', 'unlisted']
    },
    cachedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// ユーザーごとのプレイリストは一意
CachedPlaylistSchema.index({ userId: 1, playlistId: 1 }, { unique: true });

export const CachedPlaylist = mongoose.model<ICachedPlaylist>('CachedPlaylist', CachedPlaylistSchema);
