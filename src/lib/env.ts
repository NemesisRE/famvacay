import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().optional().or(z.literal('')),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  TRUSTED_PROXY_HOPS: z.coerce.number().min(1).default(1),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  NEXTAUTH_SECRET: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  PHOTON_API_URL: z.string().url().default('https://photon.komoot.io/api'),
  OPEN_HOLIDAYS_API_URL: z.string().url().default('https://openholidaysapi.org'),
  NAGER_DATE_API_URL: z.string().url().default('https://date.nager.at/api/v3'),
  OPEN_METEO_ARCHIVE_URL: z.string().url().default('https://archive-api.open-meteo.com/v1/archive'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  // During build / test phase, provide defaults if DATABASE_URL is not set
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV === 'test';
  const rawEnv = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || (isBuildPhase ? 'postgresql://build:build@localhost:5432/build' : ''),
  };

  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
      console.error('Invalid environment variables:\n', JSON.stringify(parsed.error.format(), null, 2));
      throw new Error('Invalid environment variables. Process terminating.');
    }
  }

  return (parsed.success ? parsed.data : rawEnv) as Env;
}

export const env = validateEnv();

