import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** A single origin, a comma-separated list, or "*" for any origin - see corsOrigin below. */
function parseCorsOrigin(raw: string): string | string[] {
  const origins = raw.split(',').map((origin) => origin.trim());
  return origins.length === 1 ? origins[0] : origins;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  // process.env.PORT is respected either way - Vercel's own runtime ignores it (the serverless
  // entry in api/index.ts never calls .listen()), while a traditional host (or `npm run dev`,
  // defaulting to 4000) still binds to it via src/server.ts.
  port: Number(process.env.PORT ?? 4000),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
  // A single origin ("https://app.example.com") or a comma-separated list, e.g. a production
  // domain plus Vercel preview URLs ("https://app.example.com,https://app-git-preview.vercel.app").
  // A bare "*" allows any origin. A single value still resolves to a plain string exactly like
  // before, so an existing single-origin CORS_ORIGIN needs no changes.
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN ?? 'http://localhost:5173'),
  databaseUrl: required('DATABASE_URL'),
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    refreshSecret: required('JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  seed: {
    superAdminEmail: process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@restaurant.com',
    superAdminPassword: process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'Admin@12345',
    managerEmail: process.env.SEED_MANAGER_EMAIL ?? 'manager@restaurant.com',
    managerPassword: process.env.SEED_MANAGER_PASSWORD ?? 'Manager@12345',
    staffEmail: process.env.SEED_STAFF_EMAIL ?? 'staff@restaurant.com',
    staffPassword: process.env.SEED_STAFF_PASSWORD ?? 'Staff@12345',
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  },
};
