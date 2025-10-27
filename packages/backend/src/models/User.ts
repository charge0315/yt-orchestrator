/**
 * ユーザーモデル
 * 目的: GoogleアカウントとYouTube連携に関するトークンおよびステータスを永続化します。
 * - youtubeAccessToken: API呼び出し用の短期トークン
 * - youtubeRefreshToken: アクセストークン自動更新用の長期トークン
 * - youtubeTokenExpiry: アクセストークンの有効期限
 * - reauthRequired: 再認証が必要な状態（例: invalid_grant）
 * - reauthReason: 再認証が必要となった理由コード（invalid_token, expired, missing 等）
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  googleId: string; // Google OAuth ID
  email: string;
  name?: string;
  picture?: string;
  youtubeAccessToken?: string;
  youtubeRefreshToken?: string;
  youtubeTokenExpiry?: Date;
  reauthRequired?: boolean;
  reauthReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    name: String,
    picture: String,
    youtubeAccessToken: String,
    youtubeRefreshToken: String,
    youtubeTokenExpiry: Date,
    reauthRequired: { type: Boolean, default: false },
    reauthReason: { type: String, default: undefined }
  },
  {
    timestamps: true // createdAt, updatedAtを自動生成
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
