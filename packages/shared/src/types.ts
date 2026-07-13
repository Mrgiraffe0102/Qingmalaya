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
  NotificationType,
  UserAction,
  ReviewAction,
  CommentReportStatus,
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
  manageAllClasses: boolean;
  isStudentAdmin: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** A class managed by a teacher (id + name projection). */
export interface ManagedClass {
  id: number;
  name: string;
}

/** Response shape for GET /admin/me/managed-classes. */
export interface ManagedClassesResponse {
  manageAllClasses: boolean;
  classes: ManagedClass[];
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
  markdownContent?: string | null;
  sort: number;
  status: BannerStatus;
  startAt: ISODateString | null;
  endAt: ISODateString | null;
  createdAt: ISODateString;
}

/** Banner detail with markdownContent populated (GET /banners/:id). */
export interface BannerWithMarkdown extends Banner {
  markdownContent: string | null;
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

// --- UserActivityLog ---
export interface UserActivityLog {
  id: number;
  userId: number;
  action: UserAction;
  targetType: string | null;
  targetId: number | null;
  detail: unknown;
  createdAt: ISODateString;
}

/** UserActivityLog joined with the acting user's summary (admin super-log response). */
export interface UserActivityLogWithUser extends UserActivityLog {
  userName: string;
  studentId: string;
  role: Role;
}

// --- SystemSetting ---
export interface SystemSetting {
  key: string;
  value: string;
  updatedAt: ISODateString;
}

// --- Collection (精选集) ---
export interface Collection {
  id: number;
  title: string;
  description: string | null;
  coverPath: string | null;
  sort: number;
  status: BannerStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Collection with podcasts populated (GET /collections/:id). */
export interface CollectionWithPodcasts extends Collection {
  podcasts: PodcastWithRelations[];
}

// --- UploadedFile (图片素材库) ---
export interface UploadedFile {
  id: number;
  filename: string;
  originalName: string;
  path: string;
  mimetype: string;
  size: number;
  createdAt: ISODateString;
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

// --- Notification ---
export interface NotificationItem {
  id: number;
  type: NotificationType;
  title: string;
  content: string;
  podcastId: number | null;
  podcastTitle: string | null;
  actor: UserSummary | null;
  read: boolean;
  createdAt: ISODateString;
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

// --- PodcastReview (student admin / teacher review action record) ---
export interface PodcastReview {
  id: number;
  podcastId: number;
  reviewerId: number;
  action: ReviewAction;
  reason: string | null;
  createdAt: ISODateString;
}

// --- CommentReport ---
export interface CommentReport {
  id: number;
  commentId: number;
  reporterId: number;
  reason: string;
  status: CommentReportStatus;
  resolvedById: number | null;
  resolvedAt: ISODateString | null;
  createdAt: ISODateString;
}

/** Dynamic review assignment for a student admin. */
export interface ReviewAssignment {
  studentRange: { from: string; to: string } | null;
  adminAuthorIds: number[];
  summary: string;
}

/** Podcast with flag reason/reviewer (for teacher's flagged view). */
export interface FlaggedPodcastItem extends PodcastWithRelations {
  flagReason: string | null;
  flagReviewer: UserSummary | null;
}

/** Comment with report info (for teacher's reported view). */
export interface ReportedCommentItem {
  reportId: number;
  reason: string;
  reporter: UserSummary;
  createdAt: ISODateString;
  comment: {
    id: number;
    content: string;
    createdAt: ISODateString;
    user: UserSummary;
    podcast: { id: number; title: string };
  };
}
