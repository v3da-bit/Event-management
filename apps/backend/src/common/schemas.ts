import { Schema, Types } from "mongoose";
const ref = (name: string) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required: true,
});
export const UserSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true, select: false },
    team: {
      type: String,
      enum: ["GROOM", "BRIDE"],
      required: true,
      immutable: true,
    },
    profileImage: String,
    googleCalendarConnected: { type: Boolean, default: false },
    googleCalendarDisconnectRequested: { type: Boolean, default: false },
    googleRefreshTokenEncrypted: { type: String, select: false },
    googleAccountId: String,
  },
  { timestamps: true },
);
export const EventSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    team: {
      type: String,
      enum: ["GROOM", "BRIDE"],
      required: true,
      immutable: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    location: String,
    coverImage: String,
    createdBy: ref("User"),
    deletedAt: Date,
  },
  { timestamps: true },
);
EventSchema.index({ team: 1, startDate: 1 });
export const WishlistSchema = new Schema(
  {
    eventId: ref("Event"),
    title: { type: String, required: true },
    description: { type: String, default: "" },
    image: String,
    isCompleted: { type: Boolean, default: false },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    completedAt: Date,
    createdBy: ref("User"),
  },
  { timestamps: true },
);
WishlistSchema.index({ eventId: 1 });
export const ParticipantSchema = new Schema(
  {
    eventId: ref("Event"),
    userId: ref("User"),
    joinedAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    googleCalendarEventId: String,
    calendarGeneration: { type: Number, default: 0 },
    googleCalendarId: { type: String, default: "primary" },
    syncStatus: {
      type: String,
      enum: ["PENDING", "SYNCED", "FAILED"],
      default: "PENDING",
    },
    lastSyncedAt: Date,
  },
  { timestamps: true },
);
ParticipantSchema.index({ userId: 1, eventId: 1 }, { unique: true });
export const SessionSchema = new Schema(
  {
    userId: ref("User"),
    sid: { type: String, required: true, unique: true, sparse: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const JobSchema = new Schema(
  {
    participantId: { ...ref("Participant"), unique: true },
    revision: { type: Number, default: 1 },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockedUntil: { type: Date, default: () => new Date(0) },
    lastError: String,
  },
  { timestamps: true },
);
JobSchema.index({ nextAttemptAt: 1, lockedUntil: 1 });
export const models = [
  { name: "User", schema: UserSchema },
  { name: "Event", schema: EventSchema },
  { name: "Wishlist", schema: WishlistSchema },
  { name: "Participant", schema: ParticipantSchema },
  { name: "Session", schema: SessionSchema },
  { name: "SyncJob", schema: JobSchema },
];
export function objectId(value: string) {
  return new Types.ObjectId(value);
}
