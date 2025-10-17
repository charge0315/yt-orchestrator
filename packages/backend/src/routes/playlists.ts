import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { YouTubeApiService } from '../services/youtubeApi.js';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    const playlists = await ytService.getPlaylists();
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    const playlist = await ytService.getPlaylist(req.params.id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    const playlist = await ytService.createPlaylist(name, description);
    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    const playlist = await ytService.updatePlaylist(req.params.id, name, description);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    await ytService.deletePlaylist(req.params.id);
    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

router.post('/:id/songs', async (req: AuthRequest, res: Response) => {
  try {
    const { videoId } = req.body;
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    const result = await ytService.addToPlaylist(req.params.id, videoId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add song to playlist' });
  }
});

router.delete('/:id/songs/:playlistItemId', async (req: AuthRequest, res: Response) => {
  try {
    const ytService = await YouTubeApiService.createFromUserId(req.userId!);
    await ytService.removeFromPlaylist(req.params.playlistItemId);
    res.json({ message: 'Song removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove song from playlist' });
  }
});

export default router;
