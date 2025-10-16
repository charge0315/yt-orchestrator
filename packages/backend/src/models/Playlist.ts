import mongoose, { Document, Schema } from 'mongoose';

export interface ISong {
  videoId: string;
  title: string;
  artist: string;
  duration?: string;
  thumbnail?: string;
  addedAt: Date;
}

export interface IPlaylist extends Document {
  name: string;
  description?: string;
  songs: ISong[];
  createdAt: Date;
  updatedAt: Date;
}

const SongSchema = new Schema<ISong>({
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  artist: { type: String, required: true },
  duration: { type: String },
  thumbnail: { type: String },
  addedAt: { type: Date, default: Date.now }
});

const PlaylistSchema = new Schema<IPlaylist>({
  name: { type: String, required: true },
  description: { type: String },
  songs: [SongSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
PlaylistSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IPlaylist>('Playlist', PlaylistSchema);
