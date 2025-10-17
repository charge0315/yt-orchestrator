/**
 * 認証ミドルウェア
 * セッションベースの認証処理
 */
import { Request, Response, NextFunction } from 'express';
import '../types/session.js'; // セッション型定義をインポート

/**
 * 認証済みリクエストのインターフェース
 * セッションデータにアクセス可能
 */
export interface AuthRequest extends Request {
  userId?: string; // セッションのuserIdを展開
}

/**
 * 認証ミドルウェア
 * セッションにuserIdが存在するかチェック
 * @param req リクエスト
 * @param res レスポンス
 * @param next 次のミドルウェア
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // セッションにuserIdが存在するかチェック
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // リクエストオブジェクトにuserIdを設定（既存のコードとの互換性のため）
    req.userId = req.session.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid session' });
  }
};
