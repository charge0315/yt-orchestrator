/**
 * チャンネルモデル
 * YouTubeチャンネルの情報とキャッシュデータを保存
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: Date;
  channelId: string;
  channelTitle: string;
}

export interface IChannel extends Document {
  userId: string;
  channelId: string;
  title: string;
  description: string;
  thumbnail: string;
  subscribedAt: Date;
  latestVideos: IVideo[];
  latestVideoThumbnail?: string;
  latestVideoId?: string;
  pageToken?: string; // 差分チェック用
  lastUpdated: Date;
}

const VideoSchema = new Schema({
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  thumbnail: { type: String },
  publishedAt: { type: Date, required: true },
  channelId: { type: String, required: true },
  channelTitle: { type: String }
}, { _id: false });

const ChannelSchema = new Schema({
  userId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  thumbnail: { type: String },
  subscribedAt: { type: Date, default: Date.now },
  latestVideos: [VideoSchema],
  latestVideoThumbnail: { type: String },
  latestVideoId: { type: String },
  pageToken: { type: String }, // 差分チェック用
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// 複合インデックス（ユーザーごとのチャンネル一意性）
ChannelSchema.index({ userId: 1, channelId: 1 }, { unique: true });

export const Channel = mongoose.model<IChannel>('Channel', ChannelSchema);
