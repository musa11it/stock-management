import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { sendSuccess } from './utils/apiResponse';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isProduction) {
    app.use(morgan('dev'));
  }

  const limiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(env.apiPrefix, limiter);

  app.get('/health', (_req, res) => sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() }, 'Service healthy'));

  app.use(env.apiPrefix, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
