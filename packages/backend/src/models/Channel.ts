import mongoose, { Document, Schema } from 'mongoose';

export interface IChannel extends Document {
  name: string;
  channelId: string;
  thumbnail?: string;
  description?: string;
  subscribedAt: Date;
}

const ChannelSchema = new Schema<IChannel>({
  name: { type: String, required: true },
  channelId: { type: String, required: true, unique: true },
  thumbnail: { type: String },
  description: { type: String },
  subscribedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IChannel>('Channel', ChannelSchema);
