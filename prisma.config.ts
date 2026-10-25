import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Not env('DATABASE_URL'): that throws when unset, and `prisma generate` / `validate` in CI
    // run without a database
    url: process.env.DATABASE_URL ?? '',
  },
});
