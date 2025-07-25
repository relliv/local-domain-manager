import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite',
  dbCredentials: {
    url: './data/local-domain-manager.db',
  },
  verbose: true,
  strict: true,
} satisfies Config;