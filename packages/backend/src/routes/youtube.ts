import express, { Response } from 'express';
import { google } from 'googleapis';
import User from '../models/User.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/youtube/callback`
);

// Scopes for YouTube Data API
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl'
];

// Get YouTube OAuth URL
router.get('/auth/url', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: req.userId // Pass user ID in state for callback
    });

    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// YouTube OAuth callback
router.post('/auth/callback', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return res.status(400).json({ error: 'Failed to get access token' });
    }

    // Save tokens to user
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.youtubeAccessToken = tokens.access_token;
    user.youtubeRefreshToken = tokens.refresh_token || undefined;
    user.youtubeTokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;
    await user.save();

    res.json({ message: 'YouTube account connected successfully' });
  } catch (error) {
    console.error('Error in YouTube callback:', error);
    res.status(500).json({ error: 'Failed to connect YouTube account' });
  }
});

// Check if YouTube is connected
router.get('/auth/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isConnected = !!user.youtubeAccessToken;
    const isExpired = user.youtubeTokenExpiry ? new Date() > user.youtubeTokenExpiry : false;

    res.json({
      connected: isConnected && !isExpired,
      expiresAt: user.youtubeTokenExpiry
    });
  } catch (error) {
    console.error('Error checking YouTube status:', error);
    res.status(500).json({ error: 'Failed to check YouTube status' });
  }
});

// Helper function to get valid access token (refresh if needed)
async function getValidAccessToken(userId: string): Promise<string> {
  const user = await User.findById(userId);
  if (!user || !user.youtubeAccessToken) {
    throw new Error('YouTube not connected');
  }

  // Check if token is expired
  if (user.youtubeTokenExpiry && new Date() > user.youtubeTokenExpiry) {
    // Refresh token
    if (!user.youtubeRefreshToken) {
      throw new Error('YouTube token expired and no refresh token available');
    }

    oauth2Client.setCredentials({
      refresh_token: user.youtubeRefreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    user.youtubeAccessToken = credentials.access_token || user.youtubeAccessToken;
    user.youtubeTokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : undefined;
    await user.save();

    return credentials.access_token!;
  }

  return user.youtubeAccessToken;
}

// Get user's YouTube playlists
router.get('/playlists', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accessToken = await getValidAccessToken(req.userId!);

    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const response = await youtube.playlists.list({
      part: ['snippet', 'contentDetails'],
      mine: true,
      maxResults: 50
    });

    const playlists = response.data.items || [];

    // Transform to our format
    const transformedPlaylists = playlists.map(playlist => ({
      _id: playlist.id,
      name: playlist.snippet?.title || '',
      description: playlist.snippet?.description || '',
      thumbnail: playlist.snippet?.thumbnails?.high?.url ||
                 playlist.snippet?.thumbnails?.medium?.url ||
                 playlist.snippet?.thumbnails?.default?.url,
      itemCount: playlist.contentDetails?.itemCount || 0,
      createdAt: playlist.snippet?.publishedAt,
      updatedAt: new Date()
    }));

    res.json(transformedPlaylists);
  } catch (error: any) {
    console.error('Error fetching YouTube playlists:', error);
    if (error.message === 'YouTube not connected') {
      return res.status(401).json({ error: 'YouTube account not connected' });
    }
    res.status(500).json({ error: 'Failed to fetch YouTube playlists' });
  }
});

// Get playlist items (videos in a playlist)
router.get('/playlists/:id/items', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accessToken = await getValidAccessToken(req.userId!);

    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const response = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: req.params.id,
      maxResults: 50
    });

    const items = response.data.items || [];

    // Transform to our format
    const transformedItems = items.map(item => ({
      videoId: item.contentDetails?.videoId || '',
      title: item.snippet?.title || '',
      channelTitle: item.snippet?.channelTitle || '',
      thumbnail: item.snippet?.thumbnails?.high?.url ||
                 item.snippet?.thumbnails?.medium?.url ||
                 item.snippet?.thumbnails?.default?.url,
      publishedAt: item.snippet?.publishedAt,
      addedAt: item.snippet?.publishedAt
    }));

    res.json(transformedItems);
  } catch (error) {
    console.error('Error fetching playlist items:', error);
    res.status(500).json({ error: 'Failed to fetch playlist items' });
  }
});

// Create a new playlist
router.post('/playlists', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, privacy = 'private' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Playlist name is required' });
    }

    const accessToken = await getValidAccessToken(req.userId!);

    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const response = await youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: name,
          description: description || ''
        },
        status: {
          privacyStatus: privacy
        }
      }
    });

    const playlist = response.data;

    res.status(201).json({
      _id: playlist.id,
      name: playlist.snippet?.title || '',
      description: playlist.snippet?.description || '',
      thumbnail: playlist.snippet?.thumbnails?.default?.url,
      createdAt: playlist.snippet?.publishedAt
    });
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Delete a playlist
router.delete('/playlists/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accessToken = await getValidAccessToken(req.userId!);

    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.playlists.delete({
      id: req.params.id
    });

    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

// Update a playlist
router.put('/playlists/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const accessToken = await getValidAccessToken(req.userId!);

    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const response = await youtube.playlists.update({
      part: ['snippet'],
      requestBody: {
        id: req.params.id,
        snippet: {
          title: name,
          description: description || ''
        }
      }
    });

    const playlist = response.data;

    res.json({
      _id: playlist.id,
      name: playlist.snippet?.title || '',
      description: playlist.snippet?.description || ''
    });
  } catch (error) {
    console.error('Error updating playlist:', error);
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

export default router;
