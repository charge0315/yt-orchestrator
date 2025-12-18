/**
 * セッションデータの型定義
 */
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: string; // GoogleのユーザーID
    email: string;
    name: string;
    picture?: string;
    youtubeAccessToken?: string;
    youtubeRefreshToken?: string;
    youtubeTokenExpiry?: Date;
  }
}
