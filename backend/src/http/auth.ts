import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { forbidden, unauthorized } from './errors.js';

export type Role = 'learner' | 'admin';

export interface AuthContext {
  userId: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(ctx: AuthContext): string {
  const payload: TokenPayload = { sub: ctx.userId, role: ctx.role };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return next(unauthorized());

  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    next(unauthorized('Нэвтрэлтийн хугацаа дууссан байна. Дахин нэвтэрнэ үү.'));
  }
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.role !== 'admin') return next(forbidden());
  next();
};

/** Narrows `req.auth` for handlers mounted behind `requireAuth`. */
export function authOf(req: Express.Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
