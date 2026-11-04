-- Users -----------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  avatar_url    text,
  role          text NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Content ---------------------------------------------------------------
-- Ids are text: seed content uses readable slugs ("u1-l3"), admin-created
-- content gets generated ids. `position` orders siblings; it is not unique so
-- reordering can rewrite positions without temporary collisions.
CREATE TABLE courses (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE units (
  id          text PRIMARY KEY,
  course_id   text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position    int  NOT NULL,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  -- Draft units are visible only in the admin panel, never in the app.
  published   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lessons (
  id           text PRIMARY KEY,
  unit_id      text NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  position     int  NOT NULL,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  video_url    text NOT NULL,
  duration_sec int  NOT NULL CHECK (duration_sec > 0),
  xp           int  NOT NULL DEFAULT 10 CHECK (xp >= 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quizzes (
  id           text PRIMARY KEY,
  unit_id      text NOT NULL UNIQUE REFERENCES units(id) ON DELETE CASCADE,
  title        text NOT NULL,
  pass_percent int  NOT NULL DEFAULT 60 CHECK (pass_percent BETWEEN 0 AND 100)
);

CREATE TABLE quiz_questions (
  id           text PRIMARY KEY,
  quiz_id      text  NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position     int   NOT NULL,
  text         text  NOT NULL,
  options      jsonb NOT NULL,
  answer_index int   NOT NULL CHECK (answer_index >= 0)
);

CREATE INDEX units_course_idx ON units (course_id, position);
CREATE INDEX lessons_unit_idx ON lessons (unit_id, position);
CREATE INDEX quiz_questions_quiz_idx ON quiz_questions (quiz_id, position);

-- Progress --------------------------------------------------------------
-- A lesson is completed at most once per user; the PK makes completion
-- idempotent so XP cannot be farmed by repeated requests.
CREATE TABLE lesson_completions (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    text NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  xp_earned    int  NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

-- Every quiz submission is kept (for average score / history).
CREATE TABLE quiz_attempts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id       text  NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  correct_count int   NOT NULL,
  total_count   int   NOT NULL,
  score_percent int   NOT NULL,
  passed        boolean NOT NULL,
  xp_earned     int   NOT NULL,
  answers       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quiz_attempts_user_idx ON quiz_attempts (user_id, quiz_id);
CREATE INDEX lesson_completions_user_time_idx ON lesson_completions (user_id, completed_at);
