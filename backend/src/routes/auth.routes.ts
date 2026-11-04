import { Router } from 'express';
import { z } from 'zod';
import type { UserService } from '../services/user.service.js';

const email = z.email('Имэйл буруу байна.').trim().toLowerCase();

const RegisterBody = z.object({
  name: z.string().trim().min(1, 'Нэрээ оруулна уу.').max(60),
  email,
  password: z.string().min(6, 'Нууц үг дор хаяж 6 тэмдэгт байна.').max(128),
});

const LoginBody = z.object({
  email,
  password: z.string().min(1),
});

export function authRoutes(users: UserService): Router {
  const r = Router();

  r.post('/register', async (req, res) => {
    res.status(201).json(await users.register(RegisterBody.parse(req.body)));
  });

  r.post('/login', async (req, res) => {
    res.json(await users.login(LoginBody.parse(req.body)));
  });

  return r;
}
