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

export interface RejectReasonCategory {
  title: string;
  reasons: string[];
}

export const REJECT_REASON_CATEGORIES: readonly RejectReasonCategory[] = [
  {
    title: '政治与历史导向',
    reasons: [
      '歪曲、戏说、否定党史、国史、军史内容',
      '抹黑、诋毁英雄烈士、革命伟人形象',
      '美化侵略历史、殖民人物、反动势力',
      '出现台独 / 港独 / 疆独 / 藏独等分裂言论、领土残缺表述',
      '损害国家主权、国家尊严，煽动民族对立、地域歧视',
      '宣扬历史虚无主义，崇洋媚外否定中华优秀 / 红色 / 先进文化',
      '红色题材戏谑调侃、娱乐化演绎，违背历史严肃性',
      '中外历史叙事立场错误，未批判侵略、殖民等非正义历史',
    ],
  },
  {
    title: '文本内容・色情低俗',
    reasons: [
      '完整朗读原著露骨情爱、低俗挑逗描写，未做删减',
      '配音使用暧昧、喘息、挑逗语气烘托低俗氛围',
      '渲染早恋、校园暧昧，美化畸形不健康恋爱关系',
      '非正规青春期科普，存在性暗示、色情化描写',
    ],
  },
  {
    title: '文本内容・暴力危险恐怖',
    reasons: [
      '细致朗读凶杀、斗殴、校园霸凌、虐待动物血腥细节',
      '刻意渲染惨叫、血腥画面，搭配暴力音效强化刺激',
      '详细描述自杀、自残实施过程，存在模仿诱导风险',
      '完整讲解吸毒、酗酒、纹身、飙车、作案手法等违法流程',
      '恐怖惊悚片段搭配诡异惊悚音效、恐怖配音，易引发心理恐惧',
      '内容感官刺激过强，造成未成年人长期焦虑、恐惧情绪',
    ],
  },
  {
    title: '文本内容・价值观三观',
    reasons: [
      '宣扬拜金、享乐、极端个人主义消极思想',
      '传播躺平虚无、仇恨报复、极端对立负面导向',
      '丑化教师、父母、公职人员正面形象',
      '宣扬对抗家庭伦理、校规、社会公序良俗内容',
      '灌输赌博、投机取巧、走捷径等侥幸心理',
      '恶意煽动容貌焦虑、身材焦虑、攀比风气',
      '原著封建糟粕、低俗情节未删减，无导读引导批判性阅读',
    ],
  },
  {
    title: '文本内容・经典名著',
    reasons: [
      '经典名著负面情节刻意放大负面情绪，未保持中立叙事',
      '含封建糟粕、不良价值观情节，未删减且无导读引导批判性阅读',
    ],
  },
  {
    title: '配音演绎与人声',
    reasons: [
      '朗读采用嘶吼、癫狂、黑化、轻浮戏谑、油腔滑调极端演绎',
      '配音夹带脏话、网络粗口、歧视性方言',
      '使用嘲讽、挖苦、侮辱性不尊重口吻',
      '成人油腻低俗、暧昧化配音风格，违背公序良俗',
      '额外旁白 / 赏析添加原著无提及的偏激、负面主观评价',
      '使用惊悚、沙哑诡异恐怖声线，不适配青少年受众',
    ],
  },
  {
    title: '背景音乐与音效',
    reasons: [
      '使用惨叫、血腥、诡异孩童笑声、惊悚耳鸣等违规负面音效',
      '搭配暴力击打重音、暧昧低俗 BGM',
      '全篇全程压抑惊悚配乐，持续造成听众心理不适',
      'BGM 音量高于人声，喧宾夺主影响朗读收听',
      '音频含刺耳电流杂音、突兀惊吓式音效',
      '背景音乐无合法版权，存在版权侵权风险',
    ],
  },
  {
    title: '语言文字与科学性',
    reasons: [
      '朗读存在大量错别字、读音错误、断句严重失当',
      '文言文、古诗词字音、释义、历史背景解读存在知识性错误',
      '滥用网络烂梗、黑化猎奇词汇、饭圈低俗用语',
      '未使用标准普通话，方言滥用影响阅读规范',
      '长篇压抑黑暗内容，无正向导读过渡，负面情绪堆积',
      '存在虚假科学信息、常识谬误，内容缺乏严谨性',
    ],
  },
];

/** Flattened array — indices are used by reasonTags in DTOs and stored in the DB. */
export const COMMON_REJECT_REASONS: readonly string[] =
  REJECT_REASON_CATEGORIES.flatMap((c) => c.reasons);
