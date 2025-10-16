import express, { Request, Response } from 'express';
import Playlist from '../models/Playlist.js';

const router = express.Router();

// Get all playlists
router.get('/', async (req: Request, res: Response) => {
  try {
    const playlists = await Playlist.find().sort({ updatedAt: -1 });
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// Get a single playlist by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

// Create a new playlist
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const playlist = new Playlist({
      name,
      description,
      songs: []
    });
    await playlist.save();
    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Update playlist
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const playlist = await Playlist.findByIdAndUpdate(
      req.params.id,
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
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const playlist = await Playlist.findByIdAndDelete(req.params.id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

// Add a song to playlist
router.post('/:id/songs', async (req: Request, res: Response) => {
  try {
    const { videoId, title, artist, duration, thumbnail } = req.body;
    const playlist = await Playlist.findById(req.params.id);

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
router.delete('/:id/songs/:videoId', async (req: Request, res: Response) => {
  try {
    const playlist = await Playlist.findById(req.params.id);

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
