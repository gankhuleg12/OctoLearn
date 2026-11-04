import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type Express } from 'express';
import { config } from './config.js';
import type { Db } from './db/index.js';
import { requireAdmin, requireAuth } from './http/auth.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { adminRoutes } from './routes/admin.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { learningRoutes } from './routes/learning.routes.js';
import { meRoutes } from './routes/me.routes.js';
import { createAdminService } from './services/admin.service.js';
import { createBunnyService } from './services/bunny.service.js';
import { createContentAdminService } from './services/content-admin.service.js';
import { createLearningService } from './services/learning.service.js';
import { createUserService } from './services/user.service.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp(db: Db): Express {
  const learning = createLearningService(db);
  const users = createUserService(db);
  const admin = createAdminService(db, learning);
  const bunny = createBunnyService(db);
  const content = createContentAdminService(db, bunny);

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true, db: db.driver });
  });

  app.use('/api/auth', authRoutes(users));
  // Bunny Stream calls this when encoding progresses; it only triggers a re-read from the Bunny API.
  app.post('/api/webhooks/bunny', async (req, res) => {
    res.json(await bunny.handleWebhook(req.body ?? {}));
  });
  app.use('/api/me', requireAuth, meRoutes(users, learning));
  app.use('/api/admin', requireAuth, requireAdmin, adminRoutes(admin, content, users, bunny));
  app.use('/api', requireAuth, learningRoutes(learning));
  app.use('/api', notFoundHandler);

  // Admin panel (static, talks to /api/auth + /api/admin).
  app.use(express.static(PUBLIC_DIR));

  app.use(errorHandler);
  return app;
}
