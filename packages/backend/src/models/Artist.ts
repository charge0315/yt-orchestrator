import mongoose, { Document, Schema } from 'mongoose';

export interface INewRelease {
  videoId: string;
  title: string;
  releaseDate: Date;
  thumbnail?: string;
}

export interface IArtist extends Document {
  name: string;
  artistId: string;
  thumbnail?: string;
  newReleases: INewRelease[];
  subscribedAt: Date;
  lastChecked?: Date;
}

const NewReleaseSchema = new Schema<INewRelease>({
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  releaseDate: { type: Date, required: true },
  thumbnail: { type: String }
});

const ArtistSchema = new Schema<IArtist>({
  name: { type: String, required: true },
  artistId: { type: String, required: true, unique: true },
  thumbnail: { type: String },
  newReleases: [NewReleaseSchema],
  subscribedAt: { type: Date, default: Date.now },
  lastChecked: { type: Date }
});

export default mongoose.model<IArtist>('Artist', ArtistSchema);
