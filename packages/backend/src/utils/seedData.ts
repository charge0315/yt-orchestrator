/**
 * Initial seed script that populates MongoDB with live data fetched from the YouTube Data API.
 * The script targets a demo user and stores channel and playlist cache entries so that
 * the application can render meaningful data before the first OAuth login.
 */
import mongoose from 'mongoose';
import { google, youtube_v3 } from 'googleapis';
import { CachedChannel } from '../models/CachedChannel.js';
import { CachedPlaylist } from '../models/CachedPlaylist.js';
import { User } from '../models/User.js';

const SEED_DISABLED_FLAG = '1';

// This interface was previously in the deleted Playlist.ts model
interface IPlaylistItem {
  videoId: string;
  title: string;
  thumbnail: string;
  addedAt: Date;
  position: number;
}

interface SeedResult {
  createdUsers: number;
  createdChannels: number;
  createdCachedPlaylists: number;
}

interface ChannelSeedData {
  channelId: string;
  channelTitle: string;
  channelDescription?: string;
  thumbnailUrl?: string;
  customUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
  latestVideoId?: string;
  latestVideoThumbnail?: string;
  latestVideoTitle?: string;
  latestVideoPublishedAt?: Date;
  isArtist?: boolean;
  cachedAt: Date;
}

interface PlaylistSeedSummary {
  playlistId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  channelId?: string;
  channelTitle?: string;
  itemCount?: number;
  privacy?: 'public' | 'private' | 'unlisted';
  etag?: string;
  isMusicPlaylist: boolean;
  cachedAt: Date;
}

interface PlaylistSeedData {
  summary: PlaylistSeedSummary;
  items: IPlaylistItem[];
}

const SEED_CHANNEL_IDS = [
  'UC_x5XG1OV2P6uZZ5FSM9Ttw', // Google Developers
  'UC29ju8bIPH5as8OGnQzwJyA', // Traversy Media
  'UCq19-LqvG35A-30oyAiPiqA', // COLORS
  'UCNnnwVSI5Ndo2I4a5kqWm9A', // 88rising
];

const SEED_PLAYLIST_IDS = [
  'PL-osiE80TeTs4_09Xl4tE1WqgG8i3idZu', // Node.js Crash Course
  'PLFgquLnL59alW3xmYiWRaoz0oM3H17Lth', // Today’s Top Hits
];

export async function seedInitialData(): Promise<SeedResult | null> {
  if (process.env.DISABLE_DB_SEED === SEED_DISABLED_FLAG) {
    console.log('MongoDB seed skipped: DISABLE_DB_SEED=1');
    return null;
  }

  if (mongoose.connection.readyState !== 1) {
    console.warn('MongoDB seed skipped: connection not ready');
    return null;
  }

  const [channelCount, cachedPlaylistCount, userCount] = await Promise.all([
    CachedChannel.estimatedDocumentCount().catch(() => 0),
    CachedPlaylist.estimatedDocumentCount().catch(() => 0),
    User.estimatedDocumentCount().catch(() => 0),
  ]);

  if (channelCount > 0 || cachedPlaylistCount > 0 || userCount > 0) {
    console.log('MongoDB seed skipped: existing data detected');
    return null;
  }

  const youtube = createYoutubeClient();
  const seedUserId = process.env.SEED_USER_ID || 'demo-user';
  const seedUserEmail = process.env.SEED_USER_EMAIL || 'demo@example.com';

  await User.findOneAndUpdate(
    { googleId: seedUserId },
    {
      googleId: seedUserId,
      email: seedUserEmail,
      name: process.env.SEED_USER_NAME || 'Demo User',
      picture: process.env.SEED_USER_PICTURE,
      reauthRequired: true,
      reauthReason: 'missing',
    },
    { upsert: true, new: false, setDefaultsOnInsert: true }
  );

  let createdChannels = 0;
  for (const channelId of SEED_CHANNEL_IDS) {
    try {
      const channelData = await fetchChannelSeed(youtube, channelId);
      await CachedChannel.findOneAndUpdate(
        { userId: seedUserId, channelId },
        {
          userId: seedUserId,
          channelId,
          channelTitle: channelData.channelTitle,
          channelDescription: channelData.channelDescription,
          thumbnailUrl: channelData.thumbnailUrl,
          customUrl: channelData.customUrl,
          subscriberCount: channelData.subscriberCount,
          videoCount: channelData.videoCount,
          latestVideoId: channelData.latestVideoId,
          latestVideoThumbnail: channelData.latestVideoThumbnail,
          latestVideoTitle: channelData.latestVideoTitle,
          latestVideoPublishedAt: channelData.latestVideoPublishedAt,
          subscriptionId: `seed-${channelId}`,
          isArtist: channelData.isArtist,
          cachedAt: channelData.cachedAt,
        },
        { upsert: true, new: false, setDefaultsOnInsert: true }
      );
      createdChannels += 1;
    } catch (error) {
      console.warn(`Failed to seed channel ${channelId}:`, error instanceof Error ? error.message : error);
    }
  }

  let createdCachedPlaylists = 0;

  for (const playlistId of SEED_PLAYLIST_IDS) {
    try {
      const playlistData = await fetchPlaylistSeed(youtube, playlistId);
      const summary = playlistData.summary;

      await CachedPlaylist.findOneAndUpdate(
        { userId: seedUserId, playlistId },
        {
          userId: seedUserId,
          playlistId,
          title: summary.title,
          description: summary.description,
          thumbnailUrl: summary.thumbnailUrl,
          itemCount: summary.itemCount ?? playlistData.items.length,
          channelId: summary.channelId,
          channelTitle: summary.channelTitle,
          privacy: summary.privacy,
          isMusicPlaylist: summary.isMusicPlaylist,
          etag: summary.etag,
          cachedAt: summary.cachedAt,
        },
        { upsert: true, new: false, setDefaultsOnInsert: true }
      );
      createdCachedPlaylists += 1;
    } catch (error) {
      console.warn(`Failed to seed playlist ${playlistId}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(
    `Seeded MongoDB with ${createdChannels} channels and ${createdCachedPlaylists} cached playlists for user ${seedUserId}`
  );

  return {
    createdUsers: 1,
    createdChannels,
    createdCachedPlaylists,
  };
}

function createYoutubeClient(): youtube_v3.Youtube {
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY (or GOOGLE_API_KEY) is required to seed initial data');
  }
  return google.youtube({ version: 'v3', auth: apiKey });
}

async function fetchChannelSeed(
  youtube: youtube_v3.Youtube,
  channelId: string
): Promise<ChannelSeedData> {
  const channelResponse = await youtube.channels.list({
    id: [channelId],
    part: ['snippet', 'statistics'],
    fields: 'items(id,snippet(title,description,thumbnails,customUrl),statistics(subscriberCount,videoCount))',
  });

  const channel = channelResponse.data.items?.[0];
  if (!channel) {
    throw new Error(`Channel not found for id ${channelId}`);
  }

  const snippet = channel.snippet;
  const statistics = channel.statistics;

  const searchResponse = await youtube.search.list({
    channelId,
    order: 'date',
    type: ['video'],
    maxResults: 3,
    fields: 'items(id(videoId),snippet(title,thumbnails(default,medium,high),publishedAt))',
  });

  const latestItems = searchResponse.data.items ?? [];
  const latest = latestItems[0];
  const latestSnippet = latest?.snippet;
  const latestVideoId = latest?.id?.videoId ?? undefined;
  const latestVideoPublishedAt = latestSnippet?.publishedAt ? new Date(latestSnippet.publishedAt) : undefined;

  const videoIds = latestItems
    .map((item) => item.id?.videoId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  let isArtist = false;
  if (videoIds.length > 0) {
    const categories = await collectVideoCategories(youtube, videoIds);
    if (categories.length > 0) {
      const musicCount = categories.filter((id) => id === '10').length;
      isArtist = musicCount / categories.length >= 0.5;
    }
  }

  return {
    channelId,
    channelTitle: snippet?.title ?? channelId,
    channelDescription: snippet?.description ?? undefined,
    thumbnailUrl: bestThumbnail(snippet?.thumbnails),
    customUrl: snippet?.customUrl ?? undefined,
    subscriberCount: toNumber(statistics?.subscriberCount),
    videoCount: toNumber(statistics?.videoCount),
    latestVideoId,
    latestVideoThumbnail: bestThumbnail(latestSnippet?.thumbnails),
    latestVideoTitle: latestSnippet?.title ?? undefined,
    latestVideoPublishedAt,
    isArtist,
    cachedAt: new Date(),
  };
}

async function fetchPlaylistSeed(
  youtube: youtube_v3.Youtube,
  playlistId: string
): Promise<PlaylistSeedData> {
  const playlistResponse = await youtube.playlists.list({
    id: [playlistId],
    part: ['snippet', 'contentDetails', 'status'],
    fields:
      'items(etag,id,snippet(title,description,thumbnails,channelId,channelTitle),contentDetails(itemCount),status(privacyStatus))',
  });

  const playlist = playlistResponse.data.items?.[0];
  if (!playlist) {
    throw new Error(`Playlist not found for id ${playlistId}`);
  }

  const rawItems = await fetchAllPlaylistItems(youtube, playlistId);
  const playlistItems = convertPlaylistItems(rawItems);

  const sampleIds = playlistItems.slice(0, 10).map((item) => item.videoId);
  let isMusicPlaylist = false;
  if (sampleIds.length > 0) {
    const categories = await collectVideoCategories(youtube, sampleIds);
    if (categories.length > 0) {
      const musicCount = categories.filter((id) => id === '10').length;
      isMusicPlaylist = musicCount / categories.length >= 0.5;
    }
  }

  const snippet = playlist.snippet;
  const summary: PlaylistSeedSummary = {
    playlistId,
    title: snippet?.title ?? playlistId,
    description: snippet?.description ?? undefined,
    thumbnailUrl: bestThumbnail(snippet?.thumbnails) ?? playlistItems[0]?.thumbnail ?? undefined,
    channelId: snippet?.channelId ?? undefined,
    channelTitle: snippet?.channelTitle ?? undefined,
    itemCount: Number.isFinite(playlist.contentDetails?.itemCount)
      ? playlist.contentDetails?.itemCount ?? playlistItems.length
      : playlistItems.length,
    privacy: playlist.status?.privacyStatus as PlaylistSeedSummary['privacy'],
    etag: playlist.etag ?? undefined,
    isMusicPlaylist,
    cachedAt: new Date(),
  };

  return {
    summary,
    items: playlistItems,
  };
}

async function fetchAllPlaylistItems(
  youtube: youtube_v3.Youtube,
  playlistId: string
): Promise<youtube_v3.Schema$PlaylistItem[]> {
  const items: youtube_v3.Schema$PlaylistItem[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const response = await youtube.playlistItems.list({
      playlistId,
      part: ['snippet'],
      maxResults: 50,
      pageToken,
      fields: 'items(snippet(position,publishedAt,title,thumbnails,resourceId/videoId)),nextPageToken',
    });

    const data: youtube_v3.Schema$PlaylistItemListResponse = response.data;
    if (data.items) {
      items.push(...data.items);
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}

function convertPlaylistItems(rawItems: youtube_v3.Schema$PlaylistItem[]): IPlaylistItem[] {
  const now = new Date();
  return rawItems
    .map((item, index) => {
      const snippet = item.snippet;
      const videoId = snippet?.resourceId?.videoId;
      if (!videoId) {
        return null;
      }
      return {
        videoId,
        title: snippet?.title ?? 'Untitled',
        thumbnail: bestThumbnail(snippet?.thumbnails) ?? '',
        addedAt: snippet?.publishedAt ? new Date(snippet.publishedAt) : now,
        position: typeof snippet?.position === 'number' ? snippet.position : index,
      } satisfies IPlaylistItem;
    })
    .filter((item): item is IPlaylistItem => item !== null);
}

async function collectVideoCategories(
  youtube: youtube_v3.Youtube,
  videoIds: string[]
): Promise<string[]> {
  const categories: string[] = [];
  const chunkSize = 50;

  for (let i = 0; i < videoIds.length; i += chunkSize) {
    const chunk = videoIds.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;

    const response = await youtube.videos.list({
      id: chunk,
      part: ['snippet'],
      fields: 'items(snippet/categoryId)',
    });

    const data: youtube_v3.Schema$VideoListResponse = response.data;
    const chunkCategories =
      data.items?.map((video) => video.snippet?.categoryId).filter((id): id is string => !!id) ?? [];
    categories.push(...chunkCategories);
  }

  return categories;
}

function bestThumbnail(thumbnails?: youtube_v3.Schema$ThumbnailDetails): string | undefined {
  if (!thumbnails) return undefined;
  return (
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.standard?.url ||
    thumbnails.maxres?.url ||
    thumbnails.default?.url ||
    undefined
  );
}

function toNumber(value?: string | null): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
