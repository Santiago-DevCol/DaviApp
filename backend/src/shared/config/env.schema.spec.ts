import { validate } from './env.schema';

describe('env schema', () => {
  it('applies defaults when optional variables are missing', () => {
    const env = validate({ DATABASE_URL: 'postgres://app:app@localhost:5432/techdocs' });

    expect(env).toEqual({
      DATABASE_URL: 'postgres://app:app@localhost:5432/techdocs',
      PORT: 3000,
      NODE_ENV: 'development',
      MAX_FILE_SIZE_BYTES: 10485760,
      STORAGE_DIR: './storage',
      CORS_ORIGIN: 'http://localhost:5173',
      STALE_PROCESSING_MINUTES: 15,
      SWEEP_CRON: '*/5 * * * *',
    });
  });

  it('throws a descriptive error when DATABASE_URL is invalid', () => {
    expect(() => validate({ DATABASE_URL: 'mysql://nope' })).toThrow(
      /Invalid environment configuration:[\s\S]*DATABASE_URL/,
    );
  });
});
