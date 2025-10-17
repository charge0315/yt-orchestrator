/**
 * 認証関連のルート
 * Google OAuth認証（YouTube API連携）
 * セッションベースの認証を使用
 */
import express, { Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { google } from 'googleapis';
import '../types/session.js'; // セッション型定義をインポート

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
  try {
    if (!req.session) {
      return res.status(401).json({ error: 'No session' });
    }

    res.json({
      user: {
        id: req.session.userId,
        email: req.session.email,
        name: req.session.name,
        picture: req.session.picture
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
    const oauth2Client = getOAuth2Client();
    const { code } = req.query;

    // 認証コードの検証
    if (!code || typeof code !== 'string') {
      return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
    }

    // 認証コードをアクセストークンに交換
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Googleユーザー情報の取得
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    if (!data.email || !data.id) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=no_email`);
    }

    // セッションにユーザー情報を保存
    req.session.userId = data.id; // Google IDをuserIdとして使用
    req.session.email = data.email;
    req.session.name = data.name || data.email.split('@')[0];
    req.session.picture = data.picture;
    req.session.youtubeAccessToken = tokens.access_token;
    req.session.youtubeRefreshToken = tokens.refresh_token;
    if (tokens.expiry_date) {
      req.session.youtubeTokenExpiry = new Date(tokens.expiry_date);
    }

    // セッションを保存
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

      // フロントエンドにリダイレクト
      res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
});

export default router;
