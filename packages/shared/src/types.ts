/**
 * Domain model interfaces — API response shapes matching the Prisma schema in spec.md.
 * NOTE: passwordHash is intentionally excluded from `User` (never sent over the wire).
 * All date/time fields are serialized as ISO 8601 strings (UTC).
 */
import type {
  Role,
  UserStatus,
  PodcastStatus,
  TagColor,
  CommentStatus,
  LikeTargetType,
  BannerLinkType,
  BannerStatus,
  AnnouncementStatus,
} from './enums';

/** ISO date string, e.g. "2025-01-31T08:00:00.000Z". */
export type ISODateString = string;

/** Generic paginated response envelope. */
export interface Paginated<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
}

// --- Class ---
export interface Class {
  id: number;
  name: string;
  grade: string;
  department: string;
  createdAt: ISODateString;
}

// --- User (no passwordHash) ---
export interface User {
  id: number;
  studentId: string;
  name: string;
  classId: number | null;
  role: Role;
  avatar: string | null;
  bio: string | null;
  totalListens: number;
  totalLikes: number;
  status: UserStatus;
  firstLogin: boolean;
  mustChangePassword: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Lightweight user reference embedded in other entities. */
export interface UserSummary {
  id: number;
  studentId: string;
  name: string;
  avatar: string | null;
  role: Role;
  classId: number | null;
}

// --- Tag ---
export interface Tag {
  id: number;
  name: string;
  weight: number;
  color: TagColor;
  createdAt: ISODateString;
}

// --- Podcast ---
export interface Podcast {
  id: number;
  title: string;
  description: string;
  coverPath: string;
  audioPath: string;
  duration: number;
  authorId: number;
  classId: number | null;
  status: PodcastStatus;
  playCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Podcast with author + tags populated (list/detail responses). */
export interface PodcastWithRelations extends Podcast {
  author: UserSummary;
  tags: Tag[];
  liked?: boolean;
  favorited?: boolean;
}

// --- Comment ---
export interface Comment {
  id: number;
  podcastId: number;
  userId: number;
  content: string;
  parentId: number | null;
  likeCount: number;
  status: CommentStatus;
  createdAt: ISODateString;
}

/** Comment with author + reply thread populated. */
export interface CommentWithUser extends Comment {
  user: UserSummary;
  liked?: boolean;
  replies?: CommentWithUser[];
}

// --- Like ---
export interface Like {
  id: number;
  userId: number;
  targetType: LikeTargetType;
  targetId: number;
  createdAt: ISODateString;
}

// --- Favorite ---
export interface Favorite {
  id: number;
  userId: number;
  podcastId: number;
  createdAt: ISODateString;
}

// --- PlayHistory ---
export interface PlayHistory {
  id: number;
  userId: number;
  podcastId: number;
  position: number;
  playedAt: ISODateString;
}

// --- Banner ---
export interface Banner {
  id: number;
  title: string;
  coverPath: string;
  linkType: BannerLinkType;
  linkTarget: string | null;
  sort: number;
  status: BannerStatus;
  startAt: ISODateString | null;
  endAt: ISODateString | null;
  createdAt: ISODateString;
}

// --- Announcement ---
export interface Announcement {
  id: number;
  title: string;
  content: string;
  status: AnnouncementStatus;
  publishedAt: ISODateString | null;
  createdAt: ISODateString;
}

// --- AdminLog ---
export interface AdminLog {
  id: number;
  adminId: number;
  action: string;
  targetType: string;
  targetId: number;
  detail: unknown;
  createdAt: ISODateString;
}

// --- SystemSetting ---
export interface SystemSetting {
  key: string;
  value: string;
  updatedAt: ISODateString;
}

// --- Discovery response (GET /podcasts/discovery) ---
export interface DiscoveryResponse {
  banners: Banner[];
  hot: {
    byPlay: PodcastWithRelations[];
    byLike: PodcastWithRelations[];
    byComment: PodcastWithRelations[];
  };
  recent: PodcastWithRelations[];
  classmates: PodcastWithRelations[];
}

// --- Auth responses ---
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  mustChangePassword: boolean;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface PlayProgressResponse {
  position: number;
}
