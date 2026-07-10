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
} as const;
export type PodcastStatus = (typeof PodcastStatus)[keyof typeof PodcastStatus];
export const podcastStatusSchema = z.enum(['PENDING', 'PUBLISHED', 'TAKEN_DOWN']);

// --- TagColor ---
// Spec stores lowercase mint/purple/orange in DB; uppercase keys are the TS accessors.
export const TagColor = {
  MINT: 'mint',
  PURPLE: 'purple',
  ORANGE: 'orange',
} as const;
export type TagColor = (typeof TagColor)[keyof typeof TagColor];
export const tagColorSchema = z.enum(['mint', 'purple', 'orange']);

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
