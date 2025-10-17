import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { youtubeDataApi } from '../api/client';

function YouTubeCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        console.error('YouTube OAuth error:', error);
        alert('YouTube連携に失敗しました');
        navigate('/playlists');
        return;
      }

      if (!code) {
        console.error('No authorization code received');
        navigate('/playlists');
        return;
      }

      try {
        await youtubeDataApi.authCallback(code);
        alert('YouTube連携に成功しました！');
        navigate('/playlists');
      } catch (error) {
        console.error('Failed to complete YouTube OAuth:', error);
        alert('YouTube連携の完了に失敗しました');
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
