import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Tests share one Postgres — run files serially so row counts stay stable.
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://marty:marty@localhost:5433/marty',
      FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      NODE_ENV: 'test',
    },
  },
});
