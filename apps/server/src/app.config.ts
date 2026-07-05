import { z } from 'zod';

/**
 * Application configuration.
 *
 * Reads from process.env, validates with Zod, and exposes a typed config
 * object that downstream modules (Auth, Upload, Prisma, etc.) can consume.
 */

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_ACCESS_TTL: z.string().default('2h'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_COVER_SIZE: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  MAX_AUDIO_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(200 * 1024 * 1024),
  MAX_AUDIO_DURATION: z.coerce.number().int().positive().default(3600),
});

export type AppConfig = {
  nodeEnv: string;
  port: number;
  database: {
    url: string;
  };
  jwt: {
    secret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  upload: {
    dir: string;
    maxCoverSize: number;
    maxAudioSize: number;
    maxAudioDuration: number;
  };
};

export type RawEnv = Record<string, string | undefined>;

/**
 * Build a validated AppConfig from a raw env record.
 * Throws on invalid configuration so the app fails fast at boot.
 */
export function buildConfig(env: RawEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    database: {
      url: parsed.DATABASE_URL,
    },
    jwt: {
      secret: parsed.JWT_SECRET,
      accessTtl: parsed.JWT_ACCESS_TTL,
      refreshTtl: parsed.JWT_REFRESH_TTL,
    },
    upload: {
      dir: parsed.UPLOAD_DIR,
      maxCoverSize: parsed.MAX_COVER_SIZE,
      maxAudioSize: parsed.MAX_AUDIO_SIZE,
      maxAudioDuration: parsed.MAX_AUDIO_DURATION,
    },
  };
}

/**
 * Lazily-built singleton config used across the app.
 * Re-evaluated on each call only if process.env was swapped out (tests).
 */
let cachedConfig: AppConfig | null = null;

export function appConfig(env: RawEnv = process.env): AppConfig {
  if (!cachedConfig || env !== process.env) {
    cachedConfig = buildConfig(env);
  }
  return cachedConfig;
}
