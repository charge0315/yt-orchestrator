import express, { Response } from 'express';
import YouTubePlaylist from '../models/YouTubePlaylist.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes with authentication
router.use(authenticate);

// Get all YouTube playlists for the authenticated user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playlists = await YouTubePlaylist.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch YouTube playlists' });
  }
});

// Get a single YouTube playlist by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const playlist = await YouTubePlaylist.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    if (!playlist) {
      return res.status(404).json({ error: 'YouTube playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch YouTube playlist' });
  }
});

// Create a new YouTube playlist
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const playlist = new YouTubePlaylist({
      name,
      description,
      videos: [],
      userId: req.userId
    });
    await playlist.save();
    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create YouTube playlist' });
  }
});

// Update YouTube playlist
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const playlist = await YouTubePlaylist.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { name, description },
      { new: true }
    );
    if (!playlist) {
      return res.status(404).json({ error: 'YouTube playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update YouTube playlist' });
  }
});

// Delete a YouTube playlist
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const playlist = await YouTubePlaylist.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    if (!playlist) {
      return res.status(404).json({ error: 'YouTube playlist not found' });
    }
    res.json({ message: 'YouTube playlist deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete YouTube playlist' });
  }
});

// Add a video to YouTube playlist
router.post('/:id/videos', async (req: AuthRequest, res: Response) => {
  try {
    const { videoId, title, channelTitle, duration, thumbnail, publishedAt } = req.body;
    const playlist = await YouTubePlaylist.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!playlist) {
      return res.status(404).json({ error: 'YouTube playlist not found' });
    }

    // Check if video already exists
    const exists = playlist.videos.some(v => v.videoId === videoId);
    if (exists) {
      return res.status(400).json({ error: 'Video already in playlist' });
    }

    playlist.videos.push({
      videoId,
      title,
      channelTitle,
      duration,
      thumbnail,
      publishedAt,
      addedAt: new Date()
    });

    await playlist.save();
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add video to YouTube playlist' });
  }
});

// Remove a video from YouTube playlist
router.delete('/:id/videos/:videoId', async (req: AuthRequest, res: Response) => {
  try {
    const playlist = await YouTubePlaylist.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!playlist) {
      return res.status(404).json({ error: 'YouTube playlist not found' });
    }

    playlist.videos = playlist.videos.filter(
      video => video.videoId !== req.params.videoId
    );

    await playlist.save();
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove video from YouTube playlist' });
  }
});

export default router;
