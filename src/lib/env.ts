import { z } from 'zod';

const WEAK_DEFAULT_SECRET = 'changeme-production-secret-min32chars';

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV === 'test';
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    APP_URL: z.string().url().optional().or(z.literal('')),
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    TRUSTED_PROXY_HOPS: z.coerce.number().min(1).default(1),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    VALKEY_URL: z.string().optional(),
    DRAGONFLY_URL: z.string().optional(),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    NEXTAUTH_SECRET: z.string().optional(),
    ALLOWED_ORIGINS: z.string().optional(),
    PHOTON_API_URL: z.string().url().default('https://photon.komoot.io/api'),
    OPEN_HOLIDAYS_API_URL: z.string().url().default('https://openholidaysapi.org'),
    NAGER_DATE_API_URL: z.string().url().default('https://date.nager.at/api/v3'),
    OPEN_METEO_ARCHIVE_URL: z.string().url().default('https://archive-api.open-meteo.com/v1/archive'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production' || isBuildPhase()) return;

    if (!data.NEXTAUTH_SECRET || data.NEXTAUTH_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NEXTAUTH_SECRET'],
        message: 'NEXTAUTH_SECRET must be set to a random string of at least 32 characters in production.',
      });
    } else if (data.NEXTAUTH_SECRET === WEAK_DEFAULT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NEXTAUTH_SECRET'],
        message:
          'NEXTAUTH_SECRET is still set to the placeholder value from .env.example. Generate a real secret with `openssl rand -base64 32`.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const buildPhase = isBuildPhase();
  // During build / test phase, provide a syntactically valid DATABASE_URL if one is not set,
  // since no real connection is made at build time.
  const rawEnv = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || (buildPhase ? 'postgresql://build:build@localhost:5432/build' : ''),
  };

  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    if (process.env.NODE_ENV === 'production' && !buildPhase) {
      console.error('Invalid environment variables:\n', JSON.stringify(parsed.error.format(), null, 2));
      throw new Error('Invalid environment variables. Process terminating.');
    }
    console.warn('Invalid environment variables (non-fatal outside production):\n', JSON.stringify(parsed.error.format(), null, 2));
  }

  return (parsed.success ? parsed.data : rawEnv) as Env;
}

export const env = validateEnv();

