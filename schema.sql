CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  totp_secret TEXT,
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  totp_last_step BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (totp_enabled = FALSE OR totp_secret IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC);

CREATE TABLE IF NOT EXISTS school_classes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade_level SMALLINT NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
  teacher_name TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, grade_level)
);

CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  student_number TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  grade_level SMALLINT NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
  homeroom_id BIGINT REFERENCES school_classes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS students_name_idx ON students (last_name, first_name);

CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  note TEXT NOT NULL DEFAULT '',
  marked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance (attendance_date, status);

CREATE TABLE IF NOT EXISTS grades (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  assessment TEXT NOT NULL,
  score NUMERIC(5, 2) NOT NULL CHECK (score >= 0),
  max_score NUMERIC(5, 2) NOT NULL CHECK (max_score > 0 AND score <= max_score),
  grade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS grades_student_idx ON grades (student_id, grade_date DESC);