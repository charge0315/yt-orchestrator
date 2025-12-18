/**
 * YouTube Data API のOAuthコールバック受け口。
 *
 * クエリ `code` を受け取り、バックエンド経由でトークン交換を完了したら
 * `/playlists` に戻す。
 */
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { youtubeDataApi } from '../api/client';

/**
 * YouTube連携（OAuth）完了処理を実行するページ。
 * 表示中は「処理中…」の簡易メッセージのみを出す。
 */
function YouTubeCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    /**
     * クエリパラメータを確認し、認可コードがあればバックエンドに連携完了を依頼する。
     */
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        console.error('YouTube OAuth エラー:', error);
        console.error('YouTube連携に失敗しました');
        navigate('/playlists');
        return;
      }

      if (!code) {
        console.error('認可コードが受け取れませんでした');
        navigate('/playlists');
        return;
      }

      try {
        await youtubeDataApi.authCallback(code);
        console.log('YouTube連携に成功しました！');
        navigate('/playlists');
      } catch (error) {
        console.error('YouTube OAuth の完了に失敗しました:', error);
        console.error('YouTube連携の完了に失敗しました');
        navigate('/playlists');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      color: '#ffffff'
    }}>
      YouTube連携を処理中...
    </div>
  );
}

export default YouTubeCallbackPage;
