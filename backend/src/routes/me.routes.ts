import { Router } from 'express';
import { z } from 'zod';
import { authOf } from '../http/auth.js';
import type { LearningService } from '../services/learning.service.js';
import type { UserService } from '../services/user.service.js';

const PatchMeBody = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    avatarUrl: z.url().nullable().optional(),
  })
  .refine((b) => b.name !== undefined || b.avatarUrl !== undefined, 'Өөрчлөх талбар алга.');

export function meRoutes(users: UserService, learning: LearningService): Router {
  const r = Router();

  /** Profile + statistics. */
  r.get('/', async (req, res) => {
    res.json(await users.getProfile(authOf(req).userId));
  });

  r.patch('/', async (req, res) => {
    res.json({ user: await users.updateProfile(authOf(req).userId, PatchMeBody.parse(req.body)) });
  });

  /** Wipes the caller's lesson completions and quiz attempts (testing aid). */
  r.post('/reset-progress', async (req, res) => {
    await learning.resetProgress(authOf(req).userId);
    res.status(204).end();
  });

  return r;
}
