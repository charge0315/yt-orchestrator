/**
 * APIクライアント設定
 * バックエンドAPIとの通信を管理
 */
import axios from 'axios'

// バックエンドAPIのベースURL（環境変数から取得、デフォルトはlocalhost）
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * Axiosクライアントインスタンス
 * すべてのAPI呼び出しで使用される共通設定
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Cookie認証を有効化
})

// ========================================
// 型定義
// ========================================

/**
 * 曲/動画の型
 */
export interface Song {
  videoId: string
  title: string
  artist: string
  duration?: string
  thumbnail?: string
  addedAt?: Date
}

/**
 * プレイリストの型
 */
export interface Playlist {
  id: string
  name: string
  description?: string
  songs: Song[]
  userId?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface Artist {
  id: string
  name: string
  artistId: string
  thumbnail?: string
  newReleases: NewRelease[]
  subscribedAt?: Date
}

export interface NewRelease {
  videoId: string
  title: string
  releaseDate: Date
  thumbnail?: string
}

export interface Channel {
  id: string
  name: string
  channelId: string
  thumbnail?: string
  description?: string
  subscribedAt?: Date
}

export interface Recommendation {
  videoId: string
  title: string
  artist: string
  reason: string
  thumbnail?: string
  duration?: string
}

// ========================================
// API エンドポイント
// ========================================

/**
 * プレイリストAPI
 * YouTube Data API v3と直接連携
 */
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

/**
 * アーティスト（YouTube Musicチャンネル）API
 * チャンネル登録とアーティストの最新動画を管理
 */
export const artistsApi = {
  getAll: () => apiClient.get<any[]>('/artists'),
  subscribe: (data: { channelId: string }) =>
    apiClient.post<any>('/artists', data),
  unsubscribe: (id: string) => apiClient.delete(`/artists/${id}`),
  getNewReleases: () => apiClient.get<any[]>('/artists/new-releases')
}

/**
 * チャンネルAPI
 * YouTubeチャンネルの登録を管理
 */
export const channelsApi = {
  getAll: () => apiClient.get<any[]>('/channels'),
  subscribe: (data: { channelId: string }) =>
    apiClient.post<any>('/channels', data),
  unsubscribe: (id: string) => apiClient.delete(`/channels/${id}`)
}

/**
 * おすすめAPI
 * OpenAI GPT-3.5によるチャンネル・アーティストのおすすめを取得
 */
export const recommendationsApi = {
  get: () => apiClient.get<Recommendation[]>('/recommendations')
}

/**
 * 曲検索API
 */
export const songsApi = {
  search: (query: string) => apiClient.get('/songs/search', { params: { query } })
}

/**
 * ユーザー情報の型
 */
export interface User {
  id: string
  email: string
  name: string
}

/**
 * 認証レスポンスの型
 */
export interface AuthResponse {
  user: User
  token: string
}

/**
 * 認証API
 * ユーザー登録、ログイン、Google OAuth認証
 */
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
  id: string
  name: string
  description?: string
  videos: Video[]
  userId?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface YouTubeChannel {
  id: string
  name: string
  channelId: string
  thumbnail?: string
  description?: string
  subscriberCount?: string
  latestVideos: LatestVideo[]
  userId?: string
  subscribedAt?: Date
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

// YouTube Data API (Real YouTube API)
export interface YouTubeAuthStatus {
  connected: boolean
  expiresAt?: Date
}

export const youtubeDataApi = {
  getAuthUrl: () => apiClient.get<{ url: string }>('/youtube/auth/url'),
  authCallback: (code: string) => apiClient.post('/youtube/auth/callback', { code }),
  getAuthStatus: () => apiClient.get<YouTubeAuthStatus>('/youtube/auth/status'),
  getPlaylists: () => apiClient.get<YouTubePlaylist[]>('/youtube/playlists'),
  getPlaylistItems: (id: string) => apiClient.get<Video[]>(`/youtube/playlists/${id}/items`),
  createPlaylist: (data: { name: string; description?: string; privacy?: string }) =>
    apiClient.post<YouTubePlaylist>('/youtube/playlists', data),
  updatePlaylist: (id: string, data: { name: string; description?: string }) =>
    apiClient.put<YouTubePlaylist>(`/youtube/playlists/${id}`, data),
  deletePlaylist: (id: string) => apiClient.delete(`/youtube/playlists/${id}`),
  addVideoToPlaylist: (id: string, videoId: string) =>
    apiClient.post(`/youtube/playlists/${id}/videos`, { videoId }),
  removeVideoFromPlaylist: (playlistId: string, videoId: string) =>
    apiClient.delete(`/youtube/playlists/${playlistId}/videos/${videoId}`),
  searchVideos: (query: string, maxResults?: number) =>
    apiClient.get('/youtube/search', { params: { query, maxResults } })
}

// YouTube Music API (ytmusicapi)
export const ytmusicApi = {
  saveCookie: (cookie: string) => apiClient.post('/ytmusic/auth/cookie', { cookie }),
  getAuthStatus: () => apiClient.get<{ connected: boolean }>('/ytmusic/auth/status'),
  disconnect: () => apiClient.post('/ytmusic/auth/disconnect'),
  getPlaylists: () => apiClient.get<Playlist[]>('/ytmusic/playlists'),
  getPlaylist: (id: string) => apiClient.get<Playlist>(`/ytmusic/playlists/${id}`),
  searchSongs: (query: string) => apiClient.get<Song[]>('/ytmusic/search', { params: { query } })
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
  deletePlaylist: (playlistId: string) => apiClient.delete(`/youtube/playlists/${playlistId}`),
  addVideo: (playlistId: string, videoId: string) =>
    apiClient.post(`/youtube/playlists/${playlistId}/videos`, { videoId }),
  removeVideo: (playlistId: string, videoId: string) =>
    apiClient.delete(`/youtube/playlists/${playlistId}/videos/${videoId}`),
  searchVideos: (query: string, maxResults?: number) =>
    apiClient.get('/youtube/search', { params: { query, maxResults } })
}
