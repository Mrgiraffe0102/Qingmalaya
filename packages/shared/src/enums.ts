/**
 * Domain enums as const objects + derived union types (safe under isolatedModules)
 * plus matching Zod schemas for input validation.
 *
 * The const-object pattern is used instead of `const enum` because `const enum`
 * is incompatible with `isolatedModules` / bundler module resolution.
 */
import { z } from 'zod';

// --- Role ---
export const Role = {
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  OPERATOR: 'OPERATOR',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const roleSchema = z.enum(['STUDENT', 'TEACHER', 'OPERATOR', 'SUPER_ADMIN']);

// --- UserStatus ---
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  BANNED: 'BANNED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
export const userStatusSchema = z.enum(['ACTIVE', 'BANNED']);

// --- PodcastStatus ---
export const PodcastStatus = {
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  TAKEN_DOWN: 'TAKEN_DOWN',
  FLAGGED: 'FLAGGED',
} as const;
export type PodcastStatus = (typeof PodcastStatus)[keyof typeof PodcastStatus];
export const podcastStatusSchema = z.enum(['PENDING', 'PUBLISHED', 'TAKEN_DOWN', 'FLAGGED']);

// --- TagColor ---
// Spec stores lowercase color names in DB; uppercase keys are the TS accessors.
export const TagColor = {
  MINT: 'mint',
  PURPLE: 'purple',
  ORANGE: 'orange',
  ROSE: 'rose',
  SKY: 'sky',
  TEAL: 'teal',
  INDIGO: 'indigo',
  AMBER: 'amber',
} as const;
export type TagColor = (typeof TagColor)[keyof typeof TagColor];
export const tagColorSchema = z.enum([
  'mint',
  'purple',
  'orange',
  'rose',
  'sky',
  'teal',
  'indigo',
  'amber',
]);

// --- CommentStatus ---
export const CommentStatus = {
  VISIBLE: 'VISIBLE',
  HIDDEN: 'HIDDEN',
} as const;
export type CommentStatus = (typeof CommentStatus)[keyof typeof CommentStatus];
export const commentStatusSchema = z.enum(['VISIBLE', 'HIDDEN']);

// --- LikeTargetType ---
export const LikeTargetType = {
  PODCAST: 'PODCAST',
  COMMENT: 'COMMENT',
} as const;
export type LikeTargetType = (typeof LikeTargetType)[keyof typeof LikeTargetType];
export const likeTargetTypeSchema = z.enum(['PODCAST', 'COMMENT']);

// --- BannerLinkType ---
export const BannerLinkType = {
  PODCAST: 'PODCAST',
  PODCAST_LIST: 'PODCAST_LIST',
  COLLECTION: 'COLLECTION',
  MARKDOWN: 'MARKDOWN',
  NONE: 'NONE',
} as const;
export type BannerLinkType = (typeof BannerLinkType)[keyof typeof BannerLinkType];
export const bannerLinkTypeSchema = z.enum(['PODCAST', 'PODCAST_LIST', 'COLLECTION', 'MARKDOWN', 'NONE']);

// --- BannerStatus ---
export const BannerStatus = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
} as const;
export type BannerStatus = (typeof BannerStatus)[keyof typeof BannerStatus];
export const bannerStatusSchema = z.enum(['ONLINE', 'OFFLINE']);

// --- AnnouncementStatus ---
export const AnnouncementStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
} as const;
export type AnnouncementStatus =
  (typeof AnnouncementStatus)[keyof typeof AnnouncementStatus];
export const announcementStatusSchema = z.enum(['DRAFT', 'PUBLISHED']);

// --- NotificationType ---
export const NotificationType = {
  BROADCAST: 'BROADCAST',
  PODCAST_APPROVED: 'PODCAST_APPROVED',
  PODCAST_REJECTED: 'PODCAST_REJECTED',
  PODCAST_LIKED: 'PODCAST_LIKED',
  PODCAST_COMMENTED: 'PODCAST_COMMENTED',
  PODCAST_FLAGGED: 'PODCAST_FLAGGED',
  COMMENT_REPORTED: 'COMMENT_REPORTED',
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];
export const notificationTypeSchema = z.enum([
  'BROADCAST',
  'PODCAST_APPROVED',
  'PODCAST_REJECTED',
  'PODCAST_LIKED',
  'PODCAST_COMMENTED',
  'PODCAST_FLAGGED',
  'COMMENT_REPORTED',
]);

// --- ReviewAction (student admin review actions) ---
export const ReviewAction = {
  APPROVE: 'APPROVE',
  FLAG: 'FLAG',
  REJECT: 'REJECT',
} as const;
export type ReviewAction = (typeof ReviewAction)[keyof typeof ReviewAction];
export const reviewActionSchema = z.enum(['APPROVE', 'FLAG', 'REJECT']);

// --- CommentReportStatus ---
export const CommentReportStatus = {
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED',
} as const;
export type CommentReportStatus =
  (typeof CommentReportStatus)[keyof typeof CommentReportStatus];
export const commentReportStatusSchema = z.enum(['PENDING', 'RESOLVED']);

// --- Convenience: podcast list sort options ---
export const PodcastSort = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  NAME: 'name',
  LIKES: 'likes',
  VIEWS: 'views',
} as const;
export type PodcastSort = (typeof PodcastSort)[keyof typeof PodcastSort];
export const podcastSortSchema = z.enum(['newest', 'oldest', 'name', 'likes', 'views']);

// --- UserAction (user activity log actions) ---
export const UserAction = {
  PLAY: 'PLAY',
  LIKE_PODCAST: 'LIKE_PODCAST',
  UNLIKE_PODCAST: 'UNLIKE_PODCAST',
  FAVORITE: 'FAVORITE',
  UNFAVORITE: 'UNFAVORITE',
  LIKE_COMMENT: 'LIKE_COMMENT',
  UNLIKE_COMMENT: 'UNLIKE_COMMENT',
  CREATE_COMMENT: 'CREATE_COMMENT',
  DELETE_COMMENT: 'DELETE_COMMENT',
  CREATE_PODCAST: 'CREATE_PODCAST',
  UPDATE_PODCAST: 'UPDATE_PODCAST',
  DELETE_PODCAST: 'DELETE_PODCAST',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
} as const;
export type UserAction = (typeof UserAction)[keyof typeof UserAction];
export const userActionSchema = z.enum([
  'PLAY',
  'LIKE_PODCAST',
  'UNLIKE_PODCAST',
  'FAVORITE',
  'UNFAVORITE',
  'LIKE_COMMENT',
  'UNLIKE_COMMENT',
  'CREATE_COMMENT',
  'DELETE_COMMENT',
  'CREATE_PODCAST',
  'UPDATE_PODCAST',
  'DELETE_PODCAST',
  'UPDATE_PROFILE',
]);

// --- Common reject reasons (shared by student admin + teacher reject modals) ---
export const COMMON_REJECT_REASONS = [
  '内容不当',
  '音频质量差',
  '与主题无关',
  '涉及个人隐私',
  '包含广告内容',
  '重复投稿',
] as const;
