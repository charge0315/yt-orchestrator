import mongoose, { Document, Schema } from 'mongoose';

export interface ILatestVideo {
  videoId: string;
  title: string;
  publishedAt: Date;
  thumbnail?: string;
  duration?: string;
  viewCount?: number;
}

export interface IYouTubeChannel extends Document {
  name: string;
  channelId: string;
  thumbnail?: string;
  description?: string;
  subscriberCount?: string;
  latestVideos: ILatestVideo[];
  userId: string;
  subscribedAt: Date;
  lastChecked?: Date;
}

const LatestVideoSchema = new Schema<ILatestVideo>({
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  publishedAt: { type: Date, required: true },
  thumbnail: { type: String },
  duration: { type: String },
  viewCount: { type: Number }
});

const YouTubeChannelSchema = new Schema<IYouTubeChannel>({
  name: { type: String, required: true },
  channelId: { type: String, required: true },
  thumbnail: { type: String },
  description: { type: String },
  subscriberCount: { type: String },
  latestVideos: [LatestVideoSchema],
  userId: { type: String, required: true },
  subscribedAt: { type: Date, default: Date.now },
  lastChecked: { type: Date }
});

// Compound index for userId and channelId
YouTubeChannelSchema.index({ userId: 1, channelId: 1 }, { unique: true });

export default mongoose.model<IYouTubeChannel>('YouTubeChannel', YouTubeChannelSchema);
