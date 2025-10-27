/**
 * 認証関連のルート
 * Google OAuth認証（YouTube API連携）
 * セッションベースの認証を使用
 */
import express, { Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { google } from 'googleapis';
import '../types/session.js'; // セッション型定義をインポート
import { User } from '../models/User.js';
import mongoose from 'mongoose';
import { registerUserToken, unregisterUserToken } from '../jobs/updateCache.js';

const router = express.Router();

/**
 * Google OAuth2認証用クライアントを取得
 * YouTube APIアクセスに必要なトークンを取得するために使用
 */
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3001/api/auth/google/callback'
  );
}

/**
 * POST /api/auth/logout
 * ログアウトエンドポイント
 */
router.post('/logout', (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (userId) {
    try { unregisterUserToken(userId); } catch {}
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid'); // セッションCookieをクリア
    res.json({ message: 'Logged out successfully' });
  });
});

/**
 * GET /api/auth/me
 * 現在のユーザー情報を取得（自動ログインチェック用）
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  // 現在ログイン済みのユーザー情報に加え、YouTube連携状態（再認証の要/不要）を返す
  try {
    if (!req.session) {
      return res.status(401).json({ error: 'No session' });
    }

    // 再ログイン要求フラグの判定
    let reauthRequired = false;
    let reauthReason: string | undefined = undefined;
    let reauthMessage: string | undefined = undefined; // フロント向け表示文言
    const now = new Date();

    try {
      if (mongoose.connection.readyState === 1) {
        const userDoc = await User.findOne({ googleId: req.session.userId });
        if (userDoc) {
          reauthRequired = Boolean(
            userDoc.reauthRequired ||
            !userDoc.youtubeAccessToken ||
            (userDoc.youtubeTokenExpiry ? userDoc.youtubeTokenExpiry <= now : false)
          );
          reauthReason = userDoc.reauthReason || (reauthRequired ?
            (!userDoc.youtubeAccessToken ? 'missing' : (userDoc.youtubeTokenExpiry && userDoc.youtubeTokenExpiry <= now ? 'expired' : undefined))
            : undefined);
        } else {
          // DBに存在しない場合はセッションから推定
          reauthRequired = Boolean(
            !req.session.youtubeAccessToken ||
            (req.session.youtubeTokenExpiry ? req.session.youtubeTokenExpiry <= now : false)
          );
          reauthReason = reauthRequired ? (!req.session.youtubeAccessToken ? 'missing' : (req.session.youtubeTokenExpiry && req.session.youtubeTokenExpiry <= now ? 'expired' : undefined)) : undefined;
        }
      } else {
        // DB未接続時はセッションから判定
        reauthRequired = Boolean(
          !req.session.youtubeAccessToken ||
          (req.session.youtubeTokenExpiry ? req.session.youtubeTokenExpiry <= now : false)
        );
        reauthReason = reauthRequired ? (!req.session.youtubeAccessToken ? 'missing' : (req.session.youtubeTokenExpiry && req.session.youtubeTokenExpiry <= now ? 'expired' : undefined)) : undefined;
      }
    } catch {}

    // 再認証メッセージを理由コードから決定
    if (reauthRequired) {
      switch (reauthReason) {
        case 'invalid_token':
        case 'invalid_grant':
          reauthMessage = 'YouTube連携の有効期限が切れています。再ログインしてください。';
          break;
        case 'missing':
          reauthMessage = 'YouTube連携が未設定です。Googleでログインしてください。';
          break;
        case 'expired':
          reauthMessage = 'アクセストークンの有効期限が切れています。再ログインしてください。';
          break;
        default:
          reauthMessage = 'YouTube連携の更新が必要です。再ログインしてください。';
      }
    }

    res.json({
      user: {
        id: req.session.userId,
        email: req.session.email,
        name: req.session.name,
        picture: req.session.picture,
        reauthRequired,
        reauthReason,
        reauthMessage
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * GET /api/auth/google
 * Google OAuth認証フローを開始
 * YouTube APIへのアクセス権限を要求
 */
router.get('/google', (req: Request, res: Response) => {
  // 認可URLを生成してGoogleのOAuth同意画面にリダイレクト
  const oauth2Client = getOAuth2Client();

  // 要求するスコープ（権限）
  const scopes = [
    'https://www.googleapis.com/auth/youtube', // YouTube APIへのフルアクセス
    'https://www.googleapis.com/auth/youtube.force-ssl', // SSL経由のアクセス
    'https://www.googleapis.com/auth/userinfo.email', // メールアドレスの取得
    'https://www.googleapis.com/auth/userinfo.profile' // プロフィール情報の取得
  ];

  // OAuth認証URLを生成
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // リフレッシュトークンを取得
    scope: scopes,
    prompt: 'consent' // 常に同意画面を表示（リフレッシュトークン取得のため）
  });

  // Googleの認証ページにリダイレクト
  res.redirect(url);
});

/**
 * GET /api/auth/google/callback
 * Google OAuth認証のコールバックハンドラー
 * 認証コードをトークンに交換し、ユーザー情報を取得してセッションに保存
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    // 1) 認証コードの検証→アクセストークン・リフレッシュトークンへ交換
    const oauth2Client = getOAuth2Client();
    const { code } = req.query;

    // 認証コードの検証
    if (!code || typeof code !== 'string') {
      return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
    }

    // 認証コードをアクセストークンに交換
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 2) Googleユーザー情報の取得
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    if (!data.email || !data.id) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=no_email`);
    }

    // 3) セッションにユーザー情報を保存
    req.session.userId = data.id; // Google IDをuserIdとして使用
    req.session.email = data.email;
    req.session.name = data.name || data.email.split('@')[0];
    req.session.picture = data.picture || undefined;
    req.session.youtubeAccessToken = tokens.access_token || undefined;
    req.session.youtubeRefreshToken = tokens.refresh_token || undefined;
    if (tokens.expiry_date) {
      req.session.youtubeTokenExpiry = new Date(tokens.expiry_date);
    }

    // 4) MongoDBにユーザー情報を保存（利用可能な場合）
    if (mongoose.connection.readyState === 1) {
      try {
        await User.findOneAndUpdate(
          { googleId: data.id },
          {
            $set: {
              email: data.email,
              name: data.name || data.email.split('@')[0],
              picture: data.picture || undefined,
              youtubeAccessToken: tokens.access_token || undefined,
              youtubeRefreshToken: tokens.refresh_token || undefined,
              youtubeTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
              reauthRequired: false
            },
            $unset: { reauthReason: '' }
          },
          { upsert: true, new: true }
        );
        console.log('✅ User tokens saved to MongoDB');
      } catch (dbError) {
        console.error('Failed to save user to MongoDB:', dbError);
        // MongoDBエラーは致命的ではないので続行
      }
    }

    // 5) セッションを保存
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect(`${process.env.FRONTEND_URL}?error=session_save_failed`);
      }

      // デバッグ: セッション保存の確認
      console.log('✅ User authenticated and session saved:', {
        email: req.session.email,
        hasAccessToken: !!req.session.youtubeAccessToken,
        hasRefreshToken: !!req.session.youtubeRefreshToken
      });

      // 6) バックグラウンド更新ジョブのためにトークンを登録
      if (req.session.userId && req.session.youtubeAccessToken) {
        try {
          registerUserToken(
            req.session.userId,
            req.session.youtubeAccessToken,
            req.session.youtubeRefreshToken,
            req.session.youtubeTokenExpiry
          );
        } catch {}
      }

      // フロントエンドにリダイレクト
      res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
});

export default router;
