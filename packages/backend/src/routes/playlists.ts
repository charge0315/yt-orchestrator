import express, { Response } from 'express';
import Playlist from '../models/Playlist.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes with authentication
router.use(authenticate);

// Get all playlists for the authenticated user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playlists = await Playlist.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// Get a single playlist by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const playlist = await Playlist.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

// Create a new playlist
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const playlist = new Playlist({
      name,
      description,
      songs: [],
      userId: req.userId
    });
    await playlist.save();
    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Update playlist
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const playlist = await Playlist.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { name, description },
      { new: true }
    );
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

// Delete a playlist
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const playlist = await Playlist.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

// Add a song to playlist
router.post('/:id/songs', async (req: AuthRequest, res: Response) => {
  try {
    const { videoId, title, artist, duration, thumbnail } = req.body;
    const playlist = await Playlist.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    playlist.songs.push({
      videoId,
      title,
      artist,
      duration,
      thumbnail,
      addedAt: new Date()
    });

    await playlist.save();
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add song to playlist' });
  }
});

// Remove a song from playlist
router.delete('/:id/songs/:videoId', async (req: AuthRequest, res: Response) => {
  try {
    const playlist = await Playlist.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    playlist.songs = playlist.songs.filter(
      song => song.videoId !== req.params.videoId
    );

    await playlist.save();
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove song from playlist' });
  }
});

export default router;
