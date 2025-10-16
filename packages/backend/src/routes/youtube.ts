import express, { Response } from 'express';
import { google } from 'googleapis';
import User from '../models/User.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Scopes for YouTube Data API
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl'
];

// Helper function to create OAuth2 client
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.FRONTEND_URL || 'http://localhost:5173'}/youtube/callback`
  );
}

// Get YouTube OAuth URL
router.get('/auth/url', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    console.log('Generating YouTube OAuth URL...');
    console.log('Client ID:', process.env.GOOGLE_CLIENT_ID);
    console.log('Redirect URI:', `${process.env.FRONTEND_URL || 'http://localhost:5173'}/youtube/callback`);

    const oauth2Client = getOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: req.userId // Pass user ID in state for callback
    });

    console.log('Generated auth URL:', authUrl);
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
    const oauth2Client = getOAuth2Client();
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

    const oauth2Client = getOAuth2Client();
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

    const oauth2Client = getOAuth2Client();
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

    const oauth2Client = getOAuth2Client();
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

    const oauth2Client = getOAuth2Client();
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

    const oauth2Client = getOAuth2Client();
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

    const oauth2Client = getOAuth2Client();
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

// Add a video to a playlist
router.post('/playlists/:id/videos', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const accessToken = await getValidAccessToken(req.userId!);

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.playlistItems.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          playlistId: req.params.id,
          resourceId: {
            kind: 'youtube#video',
            videoId: videoId
          }
        }
      }
    });

    res.status(201).json({ message: 'Video added to playlist successfully' });
  } catch (error) {
    console.error('Error adding video to playlist:', error);
    res.status(500).json({ error: 'Failed to add video to playlist' });
  }
});

// Remove a video from a playlist
router.delete('/playlists/:playlistId/videos/:videoId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { playlistId, videoId } = req.params;

    const accessToken = await getValidAccessToken(req.userId!);

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // First, we need to find the playlistItem ID for this video
    const listResponse = await youtube.playlistItems.list({
      part: ['id', 'contentDetails'],
      playlistId: playlistId,
      maxResults: 50
    });

    const items = listResponse.data.items || [];
    const playlistItem = items.find(item => item.contentDetails?.videoId === videoId);

    if (!playlistItem || !playlistItem.id) {
      return res.status(404).json({ error: 'Video not found in playlist' });
    }

    await youtube.playlistItems.delete({
      id: playlistItem.id
    });

    res.json({ message: 'Video removed from playlist successfully' });
  } catch (error) {
    console.error('Error removing video from playlist:', error);
    res.status(500).json({ error: 'Failed to remove video from playlist' });
  }
});

// Search for videos
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query, maxResults = 20 } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const accessToken = await getValidAccessToken(req.userId!);

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const response = await youtube.search.list({
      part: ['snippet'],
      q: query,
      type: ['video'],
      maxResults: Number(maxResults),
      videoEmbeddable: 'true'
    });

    const videos = response.data.items || [];

    // Get video details to include duration
    const videoIds = videos.map(v => v.id?.videoId).filter(Boolean);

    let videosWithDetails = videos.map(video => ({
      videoId: video.id?.videoId || '',
      title: video.snippet?.title || '',
      channelTitle: video.snippet?.channelTitle || '',
      thumbnail: video.snippet?.thumbnails?.high?.url ||
                 video.snippet?.thumbnails?.medium?.url ||
                 video.snippet?.thumbnails?.default?.url,
      publishedAt: video.snippet?.publishedAt
    }));

    // If we have video IDs, get additional details like duration
    if (videoIds.length > 0) {
      const detailsResponse = await youtube.videos.list({
        part: ['contentDetails'],
        id: videoIds as string[]
      });

      const details = detailsResponse.data.items || [];

      videosWithDetails = videosWithDetails.map(video => {
        const detail = details.find(d => d.id === video.videoId);
        return {
          ...video,
          duration: detail?.contentDetails?.duration
        };
      });
    }

    res.json(videosWithDetails);
  } catch (error) {
    console.error('Error searching videos:', error);
    res.status(500).json({ error: 'Failed to search videos' });
  }
});

export default router;
