/**
 * Zod input-validation schemas for request bodies / query strings.
 */
import { z } from 'zod';
import { podcastSortSchema } from './enums';

// --- Auth ---
export const loginSchema = z.object({
  studentId: z.string().min(1, '学号不能为空'),
  password: z.string().min(1, '密码不能为空'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, '请输入旧密码'),
    newPassword: z.string().min(6, '新密码至少 6 位'),
    confirmPassword: z.string().min(1, '请确认新密码'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// --- Podcast ---
export const createPodcastSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(30, '标题最多 30 字'),
  description: z.string().max(500, '简介最多 500 字').default(''),
  coverPath: z.string().min(1, '请上传封面'),
  audioPath: z.string().min(1, '请上传音频'),
  duration: z.number().int().positive('时长必须为正数'),
  tagIds: z.array(z.number().int()).default([]),
});
export type CreatePodcastInput = z.infer<typeof createPodcastSchema>;

export const updatePodcastSchema = createPodcastSchema.partial();
export type UpdatePodcastInput = z.infer<typeof updatePodcastSchema>;

// --- Comment ---
export const createCommentSchema = z.object({
  content: z.string().min(1, '评论内容不能为空').max(1000, '评论最多 1000 字'),
  parentId: z.number().int().positive().optional().nullable(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// --- Podcast list query (GET /podcasts) ---
// Query params arrive as strings; coerce numerics and normalize `tag` (string | string[]).
const tagArray = z
  .preprocess((val) => {
    if (val === undefined || val === null) return [];
    if (Array.isArray(val)) return val;
    return [val];
  }, z.array(z.string()))
  .optional();

export const podcastListQuerySchema = z.object({
  sort: podcastSortSchema.default('newest'),
  tag: tagArray,
  classId: z.coerce.number().int().positive().optional(),
  keyword: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type PodcastListQuery = z.infer<typeof podcastListQuerySchema>;
