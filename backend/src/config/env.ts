import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 4000),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
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
