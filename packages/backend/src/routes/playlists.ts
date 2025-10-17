/**
 * プレイリスト管理ルート
 * YouTube Data API v3と直接連携してプレイリストを管理
 */
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';

const router = express.Router();

// すべてのルートで認証を必須にする
router.use(authenticate);

/**
 * GET /api/playlists
 * ユーザーのプレイリスト一覧を取得
 * 音楽系プレイリストを除外し、動画系のもののみをフィルタリング
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const allPlaylists = await ytService.getPlaylists();

    const videoPlaylists = allPlaylists.filter((playlist: any) =>
      !ytService.isMusicPlaylist(playlist)
    );

    res.json(videoPlaylists);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.json([]);
  }
});

/**
 * GET /api/playlists/:id
 * 特定のプレイリストの詳細を取得
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const playlist = await ytService.getPlaylist(req.params.id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

/**
 * POST /api/playlists
 * 新しいプレイリストを作成
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const playlist = await ytService.createPlaylist(name, description);
    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

/**
 * PUT /api/playlists/:id
 * プレイリストの情報を更新
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const playlist = await ytService.updatePlaylist(req.params.id, name, description);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

/**
 * DELETE /api/playlists/:id
 * プレイリストを削除
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    await ytService.deletePlaylist(req.params.id);
    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

/**
 * POST /api/playlists/:id/songs
 * プレイリストに曲（動画）を追加
 */
router.post('/:id/songs', async (req: AuthRequest, res: Response) => {
  try {
    const { videoId } = req.body;
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    const result = await ytService.addToPlaylist(req.params.id, videoId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add song to playlist' });
  }
});

/**
 * DELETE /api/playlists/:id/songs/:playlistItemId
 * プレイリストから曲（動画）を削除
 */
router.delete('/:id/songs/:playlistItemId', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = YouTubeApiService.createFromAccessToken(req.session.youtubeAccessToken);
    await ytService.removeFromPlaylist(req.params.playlistItemId);
    res.json({ message: 'Song removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove song from playlist' });
  }
});

export default router;
