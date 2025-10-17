import express, { Response } from 'express';
import YTMusic from 'ytmusic-api';
import User from '../models/User.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Store YTMusic instances per user
const ytmusicInstances = new Map<string, any>();

async function getYTMusicInstance(userId: string): Promise<any> {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check if user has cookie
  if (!user.youtubeMusicCookie) {
    throw new Error('YouTube Music not connected');
  }

  // Get or create instance for this user
  if (!ytmusicInstances.has(userId)) {
    const ytmusic = new YTMusic();
    await ytmusic.initialize({
      cookie: user.youtubeMusicCookie
    });
    ytmusicInstances.set(userId, ytmusic);
  }

  return ytmusicInstances.get(userId);
}

// Save YouTube Music cookie
router.post('/auth/cookie', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { cookie } = req.body;

    if (!cookie) {
      return res.status(400).json({ error: 'Cookie is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.youtubeMusicCookie = cookie;
    await user.save();

    // Clear cached instance
    ytmusicInstances.delete(req.userId!);

    res.json({ message: 'YouTube Music cookie saved successfully' });
  } catch (error) {
    console.error('Error saving YouTube Music cookie:', error);
    res.status(500).json({ error: 'Failed to save YouTube Music cookie' });
  }
});

// Check if YouTube Music is connected
router.get('/auth/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      connected: !!user.youtubeMusicCookie
    });
  } catch (error) {
    console.error('Error checking YouTube Music status:', error);
    res.status(500).json({ error: 'Failed to check YouTube Music status' });
  }
});

// Disconnect YouTube Music
router.post('/auth/disconnect', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.youtubeMusicCookie = undefined;
    await user.save();

    // Clear cached instance
    ytmusicInstances.delete(req.userId!);

    res.json({ message: 'YouTube Music disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting YouTube Music:', error);
    res.status(500).json({ error: 'Failed to disconnect YouTube Music' });
  }
});

// Get YouTube Music playlists
router.get('/playlists', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // YouTube Music API integration is not fully implemented yet
    // Return empty array for now
    res.json([]);
  } catch (error: any) {
    console.error('Error fetching YouTube Music playlists:', error);
    res.status(500).json({ error: 'Failed to fetch YouTube Music playlists' });
  }
});

// Get playlist details with songs
router.get('/playlists/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ytmusicInstance = await getYTMusicInstance(req.userId!);
    const playlist = await ytmusicInstance.getPlaylist(req.params.id);

    const transformedPlaylist = {
      _id: playlist.playlistId,
      name: playlist.title,
      description: playlist.description || '',
      thumbnail: playlist.thumbnails?.[0]?.url,
      songs: playlist.tracks?.map((track: any) => ({
        videoId: track.videoId,
        title: track.title,
        artist: track.artists?.[0]?.name || 'Unknown Artist',
        duration: track.duration,
        thumbnail: track.thumbnails?.[0]?.url,
        addedAt: new Date()
      })) || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.json(transformedPlaylist);
  } catch (error) {
    console.error('Error fetching YouTube Music playlist:', error);
    res.status(500).json({ error: 'Failed to fetch YouTube Music playlist' });
  }
});

// Search for songs
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const ytmusicInstance = await getYTMusicInstance(req.userId!);
    const results = await ytmusicInstance.searchSongs(query);

    const transformedResults = results.map((song: any) => ({
      videoId: song.videoId,
      title: song.name,
      artist: song.artist?.name || 'Unknown Artist',
      duration: song.duration,
      thumbnail: song.thumbnails?.[0]?.url
    }));

    res.json(transformedResults);
  } catch (error) {
    console.error('Error searching YouTube Music:', error);
    res.status(500).json({ error: 'Failed to search YouTube Music' });
  }
});

export default router;
