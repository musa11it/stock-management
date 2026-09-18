// Vercel serverless entry point. Not used by local dev (`npm run dev`) or the traditional
// `npm start` - those still go through src/server.ts's app.listen(). This file exists only so
// Vercel's Node runtime (@vercel/node) has something under /api to build as a serverless
// function; it does no extra work of its own, it just hands Vercel the exact same Express app
// every other environment runs, unlisten'd.
//
// createApp() wires no I/O of its own (no app.listen(), no eager DB connect - Prisma connects
// lazily on first query), so building it once at module scope is safe and lets Node's module
// cache reuse the same app (and Prisma's connection pool) across warm invocations of the same
// container, instead of rebuilding the whole middleware stack on every request.
import { createApp } from '../src/app';

const app = createApp();

export default app;
