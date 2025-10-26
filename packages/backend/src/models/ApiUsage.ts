import mongoose, { Document, Schema } from 'mongoose';

export interface IApiUsage extends Document {
  userId: string;
  service: 'youtube';
  dateKey: string; // YYYY-MM-DD (UTC)
  count: number;
  lastCalledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApiUsageSchema = new Schema<IApiUsage>(
  {
    userId: { type: String, required: true, index: true },
    service: { type: String, required: true },
    dateKey: { type: String, required: true },
    count: { type: Number, default: 0 },
    lastCalledAt: { type: Date },
  },
  { timestamps: true }
);

// 1ユーザー×サービス×日でユニーク
ApiUsageSchema.index({ userId: 1, service: 1, dateKey: 1 }, { unique: true });

export const ApiUsage = mongoose.model<IApiUsage>('ApiUsage', ApiUsageSchema);

