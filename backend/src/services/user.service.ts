import bcrypt from 'bcryptjs';
import type { Db } from '../db/index.js';
import { signToken } from '../http/auth.js';
import { conflict, notFound, unauthorized } from '../http/errors.js';
import { getAllContentIds } from '../repositories/content.repo.js';
import { getProgressSets } from '../repositories/progress.repo.js';
import {
  findUserById,
  findUserWithHashByEmail,
  insertUser,
  listUsersWithProgress,
  updateUser,
  type User,
} from '../repositories/user.repo.js';
import { buildProfileStats } from './stats.service.js';

const BCRYPT_ROUNDS = 10;
// Compared against when the email is unknown, so response timing does not reveal registered emails.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

function session(user: User) {
  return { token: signToken({ userId: user.id, role: user.role }), user };
}

export function createUserService(db: Db) {
  return {
    async register(input: { name: string; email: string; password: string }) {
      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      const user = await insertUser(db, { email: input.email, name: input.name, passwordHash });
      if (!user) throw conflict('EMAIL_TAKEN', 'Энэ имэйл бүртгэлтэй байна.');
      return session(user);
    },

    async login(input: { email: string; password: string }) {
      const found = await findUserWithHashByEmail(db, input.email);
      const ok = await bcrypt.compare(input.password, found?.passwordHash ?? DUMMY_HASH);
      if (!found || !ok) throw unauthorized('Имэйл эсвэл нууц үг буруу байна.');
      const { passwordHash: _omit, ...user } = found;
      return session(user);
    },

    async getProfile(userId: string) {
      const user = await findUserById(db, userId);
      if (!user) throw unauthorized('Хэрэглэгч олдсонгүй. Дахин нэвтэрнэ үү.');
      const [scope, progress] = await Promise.all([getAllContentIds(db), getProgressSets(db, userId)]);
      return { user, stats: await buildProfileStats(db, userId, scope, progress) };
    },

    async updateProfile(userId: string, patch: { name?: string; avatarUrl?: string | null }) {
      const user = await updateUser(db, userId, patch);
      if (!user) throw notFound('Хэрэглэгч олдсонгүй.');
      return user;
    },

    listUsers: () => listUsersWithProgress(db),
  };
}

export type UserService = ReturnType<typeof createUserService>;
