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
    // Paid Open-Meteo plan: required to fetch rain-duration data in commercial operation mode
    // (the free API is non-commercial only), see src/lib/integrations/open-meteo-access.ts
    OPEN_METEO_API_KEY: z.string().optional(),
    OPEN_METEO_CUSTOMER_ARCHIVE_URL: z.string().url().optional(),
    // Outgoing mail (confirmation links, passport reminders) - optional, see src/lib/mail/mailer.ts
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().regex(/^\d*$/, 'SMTP_PORT must be a number').optional(),
    SMTP_SECURE: z.enum(['true', 'false', '']).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_ALLOW_INSECURE: z.enum(['true', 'false', '']).optional(),
    MAIL_FROM: z.string().optional(),
    // In-app background refresh of the reference datasets (default: on in production);
    // empty means "use the default", as in .env.example
    DATASET_AUTO_REFRESH: z.enum(['true', 'false', '']).optional(),

    // Impressum / Datenschutz (§5 DDG, Art. 13/14 GDPR) - all have safe placeholder fallbacks so
    // the build never fails without real operator details configured.
    LEGAL_OPERATION_MODE: z.enum(['private', 'commercial']).default('private'),
    LEGAL_OPERATOR_NAME: z.string().default('[Operator name not yet configured - set LEGAL_OPERATOR_NAME]'),
    LEGAL_OPERATOR_STREET: z.string().default('[Street and house number not yet configured]'),
    LEGAL_OPERATOR_POSTAL_CITY: z.string().default('[Postal code and city not yet configured]'),
    LEGAL_OPERATOR_COUNTRY: z.string().default('Deutschland / Germany'),
    LEGAL_CONTACT_EMAIL: z.string().default('contact@example.invalid'),
    LEGAL_CONTACT_PHONE: z.string().optional(),
    LEGAL_VAT_ID: z.string().optional(),
    LEGAL_HOSTING_PROVIDER_NAME: z.string().default('[Hosting provider not yet configured]'),
    LEGAL_HOSTING_PROVIDER_ADDRESS: z.string().default('[Hosting provider address not yet configured]'),
    LEGAL_DPA_CONCLUDED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),

    // Cookie/privacy banner + self-hosted Umami analytics (§25 TDDDG)
    NEXT_PUBLIC_COOKIE_BANNER_MODE: z
      .enum(['TRANSPARENCY_AND_CHOICE', 'STRICT_OPT_IN', 'NONE'])
      .default('TRANSPARENCY_AND_CHOICE'),
    NEXT_PUBLIC_UMAMI_SCRIPT_URL: z.string().optional(),
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().optional(),
    UMAMI_INTERNAL_URL: z.string().url().optional(),
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

  // Not fatal: the database is only reachable on the internal network, but the compose default
  // password is public
  if (process.env.NODE_ENV === 'production' && !buildPhase && rawEnv.DATABASE_URL.includes(':famvacay_secure_password@')) {
    console.warn('[env] DATABASE_URL uses the default password from docker-compose.yml. Set POSTGRES_PASSWORD to a random value.');
  }

  return (parsed.success ? parsed.data : rawEnv) as Env;
}

export const env = validateEnv();

