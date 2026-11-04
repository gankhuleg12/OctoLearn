import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Db, Queryable } from './index.js';

const SEED_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-data', 'course.json');

export const SeedSchema = z.object({
  course: z.object({ id: z.string(), title: z.string(), description: z.string().default('') }),
  units: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().default(''),
      published: z.boolean().default(true),
      lessons: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string().default(''),
          videoUrl: z.url(),
          durationSec: z.number().int().positive(),
          xp: z.number().int().nonnegative().default(10),
        }),
      ),
      quiz: z.object({
        id: z.string(),
        title: z.string(),
        passPercent: z.number().int().min(0).max(100).default(60),
        questions: z
          .array(
            z
              .object({
                id: z.string(),
                text: z.string(),
                options: z.array(z.string()).min(2),
                answerIndex: z.number().int().nonnegative(),
              })
              .refine((q) => q.answerIndex < q.options.length, 'answerIndex out of range'),
          )
          .min(1),
      })
        .nullish(),
    }),
  ),
  users: z
    .array(
      z.object({
        email: z.email(),
        name: z.string(),
        password: z.string(),
        role: z.enum(['learner', 'admin']),
      }),
    )
    .default([]),
});

export type SeedData = z.infer<typeof SeedSchema>;

export async function loadSeedData(): Promise<SeedData> {
  return SeedSchema.parse(JSON.parse(await readFile(SEED_FILE, 'utf8')));
}

/**
 * Called on server boot. Content is seeded only into an empty database so
 * edits made in the admin panel survive restarts; demo users are always
 * ensured (inserted only if missing).
 */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  const [row] = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM courses');
  const data = await loadSeedData();
  if (row?.n) {
    await seedUsers(db, data.users);
    return false;
  }
  await seed(db, data);
  return true;
}

async function seedUsers(q: Queryable, users: SeedData['users']): Promise<void> {
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await q.query(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [u.email.toLowerCase(), u.name, hash, u.role],
    );
  }
}

/**
 * Upserts the seed content by id (overwrites admin edits to seeded items —
 * used by `npm run db:seed` / `db:reset`). Users are inserted only if missing.
 */
export async function seed(db: Db, data?: SeedData): Promise<void> {
  const { course, units, users } = data ?? (await loadSeedData());

  await db.tx(async (q) => {
    await q.query(
      `INSERT INTO courses (id, title, description) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description`,
      [course.id, course.title, course.description],
    );

    for (const [ui, unit] of units.entries()) {
      await q.query(
        `INSERT INTO units (id, course_id, position, title, description, published) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, position = EXCLUDED.position,
           title = EXCLUDED.title, description = EXCLUDED.description, published = EXCLUDED.published`,
        [unit.id, course.id, ui + 1, unit.title, unit.description, unit.published],
      );

      for (const [li, l] of unit.lessons.entries()) {
        await q.query(
          `INSERT INTO lessons (id, unit_id, position, title, description, video_url, duration_sec, xp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET unit_id = EXCLUDED.unit_id, position = EXCLUDED.position,
             title = EXCLUDED.title, description = EXCLUDED.description, video_url = EXCLUDED.video_url,
             duration_sec = EXCLUDED.duration_sec, xp = EXCLUDED.xp`,
          [l.id, unit.id, li + 1, l.title, l.description, l.videoUrl, l.durationSec, l.xp],
        );
      }

      const quiz = unit.quiz;
      if (!quiz) continue;
      await q.query(
        `INSERT INTO quizzes (id, unit_id, title, pass_percent) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET unit_id = EXCLUDED.unit_id, title = EXCLUDED.title,
           pass_percent = EXCLUDED.pass_percent`,
        [quiz.id, unit.id, quiz.title, quiz.passPercent],
      );
      for (const [qi, question] of quiz.questions.entries()) {
        await q.query(
          `INSERT INTO quiz_questions (id, quiz_id, position, text, options, answer_index)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)
           ON CONFLICT (id) DO UPDATE SET quiz_id = EXCLUDED.quiz_id, position = EXCLUDED.position,
             text = EXCLUDED.text, options = EXCLUDED.options, answer_index = EXCLUDED.answer_index`,
          [question.id, quiz.id, qi + 1, question.text, JSON.stringify(question.options), question.answerIndex],
        );
      }
    }

    await seedUsers(q, users);
  });
}
