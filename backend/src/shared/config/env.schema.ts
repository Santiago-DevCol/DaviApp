import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((url) => /^postgres(ql)?:\/\//.test(url), {
      message: 'must be a postgres:// or postgresql:// connection string',
    }),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  STORAGE_DIR: z.string().min(1).default('./storage'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Used by `ConfigModule.forRoot({ validate })`. Throws a readable error listing
 * every invalid variable so the process fails fast at boot.
 */
export function validate(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
