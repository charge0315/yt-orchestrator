import { google, youtube_v3 } from 'googleapis';
import User from '../models/User.js';

export class YouTubeApiService {
  private youtube: youtube_v3.Youtube;

  constructor(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.FRONTEND_URL
    );
    oauth2Client.setCredentials({ access_token: accessToken });
    this.youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  }

  static async createFromUserId(userId: string): Promise<YouTubeApiService> {
    const user = await User.findById(userId);
    if (!user?.youtubeAccessToken) {
      throw new Error('YouTube access token not found');
    }
    return new YouTubeApiService(user.youtubeAccessToken);
  }

  async getPlaylists() {
    const response = await this.youtube.playlists.list({
      part: ['snippet', 'contentDetails'],
      mine: true,
      maxResults: 50
    });
    return response.data.items || [];
  }

  async getPlaylist(playlistId: string) {
    const response = await this.youtube.playlists.list({
      part: ['snippet', 'contentDetails'],
      id: [playlistId]
    });
    return response.data.items?.[0];
  }

  async createPlaylist(title: string, description?: string) {
    const response = await this.youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: { title, description },
        status: { privacyStatus: 'private' }
      }
    });
    return response.data;
  }

  async updatePlaylist(playlistId: string, title: string, description?: string) {
    const response = await this.youtube.playlists.update({
      part: ['snippet'],
      requestBody: {
        id: playlistId,
        snippet: { title, description }
      }
    });
    return response.data;
  }

  async deletePlaylist(playlistId: string) {
    await this.youtube.playlists.delete({ id: playlistId });
  }

  async getPlaylistItems(playlistId: string) {
    const response = await this.youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId,
      maxResults: 50
    });
    return response.data.items || [];
  }

  async addToPlaylist(playlistId: string, videoId: string) {
    const response = await this.youtube.playlistItems.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          playlistId,
          resourceId: { kind: 'youtube#video', videoId }
        }
      }
    });
    return response.data;
  }

  async removeFromPlaylist(playlistItemId: string) {
    await this.youtube.playlistItems.delete({ id: playlistItemId });
  }

  async getSubscriptions() {
    const response = await this.youtube.subscriptions.list({
      part: ['snippet', 'contentDetails'],
      mine: true,
      maxResults: 50
    });
    return response.data.items || [];
  }

  async subscribe(channelId: string) {
    const response = await this.youtube.subscriptions.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          resourceId: { kind: 'youtube#channel', channelId }
        }
      }
    });
    return response.data;
  }

  async unsubscribe(subscriptionId: string) {
    await this.youtube.subscriptions.delete({ id: subscriptionId });
  }

  async getChannelVideos(channelId: string, maxResults = 10) {
    const response = await this.youtube.search.list({
      part: ['snippet'],
      channelId,
      order: 'date',
      type: ['video'],
      maxResults
    });
    return response.data.items || [];
  }
}
