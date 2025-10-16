import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Enable cookies for authentication
})

export interface Song {
  videoId: string
  title: string
  artist: string
  duration?: string
  thumbnail?: string
  addedAt?: Date
}

export interface Playlist {
  _id: string
  name: string
  description?: string
  songs: Song[]
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface Artist {
  _id: string
  name: string
  artistId: string
  thumbnail?: string
  newReleases: NewRelease[]
  subscribedAt: Date
}

export interface NewRelease {
  videoId: string
  title: string
  releaseDate: Date
  thumbnail?: string
}

export interface Channel {
  _id: string
  name: string
  channelId: string
  thumbnail?: string
  description?: string
  subscribedAt: Date
}

export interface Recommendation {
  videoId: string
  title: string
  artist: string
  reason: string
  thumbnail?: string
  duration?: string
}

// Playlists API
export const playlistsApi = {
  getAll: () => apiClient.get<Playlist[]>('/playlists'),
  getById: (id: string) => apiClient.get<Playlist>(`/playlists/${id}`),
  create: (data: { name: string; description?: string }) =>
    apiClient.post<Playlist>('/playlists', data),
  update: (id: string, data: { name: string; description?: string }) =>
    apiClient.put<Playlist>(`/playlists/${id}`, data),
  delete: (id: string) => apiClient.delete(`/playlists/${id}`),
  addSong: (id: string, song: Song) =>
    apiClient.post<Playlist>(`/playlists/${id}/songs`, song),
  removeSong: (id: string, videoId: string) =>
    apiClient.delete<Playlist>(`/playlists/${id}/songs/${videoId}`)
}

// Artists API
export const artistsApi = {
  getAll: () => apiClient.get<Artist[]>('/artists'),
  subscribe: (data: { name: string; artistId: string; thumbnail?: string }) =>
    apiClient.post<Artist>('/artists', data),
  unsubscribe: (id: string) => apiClient.delete(`/artists/${id}`),
  getNewReleases: () => apiClient.get<NewRelease[]>('/artists/new-releases')
}

// Channels API
export const channelsApi = {
  getAll: () => apiClient.get<Channel[]>('/channels'),
  subscribe: (data: { name: string; channelId: string; thumbnail?: string; description?: string }) =>
    apiClient.post<Channel>('/channels', data),
  unsubscribe: (id: string) => apiClient.delete(`/channels/${id}`)
}

// Recommendations API
export const recommendationsApi = {
  get: () => apiClient.get<Recommendation[]>('/recommendations')
}

// Songs API
export const songsApi = {
  search: (query: string) => apiClient.get('/songs/search', { params: { query } })
}

// Auth API
export interface User {
  id: string
  email: string
  name: string
}

export interface AuthResponse {
  user: User
  token: string
}

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    apiClient.post<AuthResponse>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/login', data),
  googleLogin: (credential: string) =>
    apiClient.post<AuthResponse>('/auth/google', { credential }),
  logout: () => apiClient.post('/auth/logout'),
  me: () => apiClient.get<{ user: User }>('/auth/me')
}

// YouTube Types
export interface Video {
  videoId: string
  title: string
  channelTitle: string
  duration?: string
  thumbnail?: string
  publishedAt?: Date
  addedAt?: Date
}

export interface YouTubePlaylist {
  _id: string
  name: string
  description?: string
  videos: Video[]
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface YouTubeChannel {
  _id: string
  name: string
  channelId: string
  thumbnail?: string
  description?: string
  subscriberCount?: string
  latestVideos: LatestVideo[]
  userId: string
  subscribedAt: Date
  lastChecked?: Date
}

export interface LatestVideo {
  videoId: string
  title: string
  publishedAt: Date
  thumbnail?: string
  duration?: string
  viewCount?: number
  channelName?: string
  channelId?: string
  channelThumbnail?: string
}

export interface ChannelRecommendation {
  channelId: string
  name: string
  thumbnail?: string
  subscriberCount?: string
  description?: string
  reason: string
}

// YouTube Playlists API
export const youtubePlaylistsApi = {
  getAll: () => apiClient.get<YouTubePlaylist[]>('/youtube/playlists'),
  getById: (id: string) => apiClient.get<YouTubePlaylist>(`/youtube/playlists/${id}`),
  create: (data: { name: string; description?: string }) =>
    apiClient.post<YouTubePlaylist>('/youtube/playlists', data),
  update: (id: string, data: { name: string; description?: string }) =>
    apiClient.put<YouTubePlaylist>(`/youtube/playlists/${id}`, data),
  delete: (id: string) => apiClient.delete(`/youtube/playlists/${id}`),
  addVideo: (id: string, video: Video) =>
    apiClient.post<YouTubePlaylist>(`/youtube/playlists/${id}/videos`, video),
  removeVideo: (id: string, videoId: string) =>
    apiClient.delete<YouTubePlaylist>(`/youtube/playlists/${id}/videos/${videoId}`)
}

// YouTube Channels API
export const youtubeChannelsApi = {
  getAll: () => apiClient.get<YouTubeChannel[]>('/youtube/channels'),
  subscribe: (data: { name: string; channelId: string; thumbnail?: string; description?: string; subscriberCount?: string }) =>
    apiClient.post<YouTubeChannel>('/youtube/channels', data),
  unsubscribe: (id: string) => apiClient.delete(`/youtube/channels/${id}`),
  getLatestVideos: () => apiClient.get<LatestVideo[]>('/youtube/channels/latest-videos'),
  updateVideos: (id: string, latestVideos: LatestVideo[]) =>
    apiClient.post<YouTubeChannel>(`/youtube/channels/${id}/update-videos`, { latestVideos })
}

// YouTube Recommendations API
export const youtubeRecommendationsApi = {
  getChannels: () => apiClient.get<ChannelRecommendation[]>('/youtube/recommendations/channels'),
  getVideos: () => apiClient.get<LatestVideo[]>('/youtube/recommendations/videos')
}

// YouTube OAuth API
export const youtubeOAuthApi = {
  getAuthUrl: () => apiClient.get<{ url: string }>('/youtube/auth/url'),
  handleCallback: (code: string) => apiClient.post('/youtube/auth/callback', { code }),
  getStatus: () => apiClient.get<{ connected: boolean; expiresAt?: Date }>('/youtube/auth/status')
}

// YouTube API (direct from YouTube, not MongoDB)
export const youtubeApi = {
  getPlaylists: () => apiClient.get('/youtube/playlists'),
  getPlaylistItems: (playlistId: string) => apiClient.get(`/youtube/playlists/${playlistId}/items`),
  createPlaylist: (data: { name: string; description?: string; privacy?: string }) =>
    apiClient.post('/youtube/playlists', data),
  updatePlaylist: (playlistId: string, data: { name: string; description?: string }) =>
    apiClient.put(`/youtube/playlists/${playlistId}`, data),
  deletePlaylist: (playlistId: string) => apiClient.delete(`/youtube/playlists/${playlistId}`)
}
