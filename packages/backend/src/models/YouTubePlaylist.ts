import mongoose, { Document, Schema } from 'mongoose';

export interface IVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  duration?: string;
  thumbnail?: string;
  publishedAt?: Date;
  addedAt: Date;
}

export interface IYouTubePlaylist extends Document {
  name: string;
  description?: string;
  videos: IVideo[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<IVideo>({
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  channelTitle: { type: String, required: true },
  duration: { type: String },
  thumbnail: { type: String },
  publishedAt: { type: Date },
  addedAt: { type: Date, default: Date.now }
});

const YouTubePlaylistSchema = new Schema<IYouTubePlaylist>({
  name: { type: String, required: true },
  description: { type: String },
  videos: [VideoSchema],
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
YouTubePlaylistSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IYouTubePlaylist>('YouTubePlaylist', YouTubePlaylistSchema);
