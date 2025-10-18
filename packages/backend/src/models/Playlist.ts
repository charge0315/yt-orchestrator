/**
 * プレイリストモデル
 * YouTubeプレイリストの情報とキャッシュデータを保存
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IPlaylistItem {
  videoId: string;
  title: string;
  thumbnail: string;
  addedAt: Date;
  position: number;
}

export interface IPlaylist extends Document {
  userId: string;
  playlistId: string;
  title: string;
  description: string;
  thumbnail: string;
  itemCount: number;
  items: IPlaylistItem[];
  isMusicPlaylist: boolean;
  pageToken?: string; // 差分チェック用
  lastUpdated: Date;
}

const PlaylistItemSchema = new Schema({
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  thumbnail: { type: String },
  addedAt: { type: Date, required: true },
  position: { type: Number, required: true }
}, { _id: false });

const PlaylistSchema = new Schema({
  userId: { type: String, required: true, index: true },
  playlistId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  thumbnail: { type: String },
  itemCount: { type: Number, default: 0 },
  items: [PlaylistItemSchema],
  isMusicPlaylist: { type: Boolean, default: false },
  pageToken: { type: String }, // 差分チェック用
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// 複合インデックス（ユーザーごとのプレイリスト一意性）
PlaylistSchema.index({ userId: 1, playlistId: 1 }, { unique: true });

export const Playlist = mongoose.model<IPlaylist>('Playlist', PlaylistSchema);
