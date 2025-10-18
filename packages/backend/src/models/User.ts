/**
 * ユーザーモデル
 * YouTube認証トークンを保存
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
    youtubeTokenExpiry: Date
  },
  {
    timestamps: true // createdAt, updatedAtを自動生成
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
