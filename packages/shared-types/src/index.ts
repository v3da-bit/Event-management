export type Team = "GROOM" | "BRIDE";
export type SyncStatus = "PENDING" | "SYNCED" | "FAILED";
export interface LocationPin {
  lat: number;
  lng: number;
}
export interface User {
  _id: string;
  fullName: string;
  email: string;
  team: Team;
  profileImage?: string;
  googleCalendarConnected: boolean;
}
export interface WishlistItem {
  _id: string;
  eventId: string;
  title: string;
  description: string;
  image?: string;
  location?: string;
  locationPin?: LocationPin | null;
  isCompleted: boolean;
  completedBy?: string;
  completedAt?: string;
}
export interface Participant {
  _id: string;
  userId: User;
  syncStatus: SyncStatus;
  joinedAt: string;
}
export interface WeddingEvent {
  _id: string;
  title: string;
  description: string;
  team: Team;
  startDate: string;
  endDate: string;
  timezone: string;
  location?: string;
  locationPin?: LocationPin | null;
  reminderMinutes?: number;
  coverImage?: string;
  createdBy: string;
  wishlist: WishlistItem[];
  participantCount: number;
  joined: boolean;
  syncStatus?: SyncStatus;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface EventReminder {
  _id: string;
  title: string;
  startDate: string;
  timezone: string;
  reminderMinutes: number;
  pendingItems: WishlistItem[];
}
