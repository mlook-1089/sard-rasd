import { neon } from '@neondatabase/serverless';

/**
 * Idempotent schema create + migrations.
 * - v1 base tables (IF NOT EXISTS)
 * - v2 programs system: adds programs table, program_id on sessions,
 *   rebuilds attendance to be program-scoped (one status per student×program)
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const sql = neon(url);

  // --- v1: base tables ---
  await sql`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    institution_name TEXT NOT NULL DEFAULT 'مجمع تحفيظ القرآن الكريم',
    logo_url TEXT, sub_logo_url TEXT, login_image_url TEXT, certificate_bg_url TEXT,
    total_score INTEGER NOT NULL DEFAULT 100,
    pass_threshold INTEGER NOT NULL DEFAULT 60,
    error_deduction INTEGER NOT NULL DEFAULT 2,
    alert_deduction INTEGER NOT NULL DEFAULT 1,
    slow_session_minutes INTEGER NOT NULL DEFAULT 5,
    stuck_session_minutes INTEGER NOT NULL DEFAULT 10,
    honor_labels JSONB NOT NULL DEFAULT '{}'::jsonb,
    whatsapp_template TEXT NOT NULL DEFAULT '',
    admin_password_hash TEXT NOT NULL,
    reciter_password_hash TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS circles (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL,
    teacher_name TEXT, teacher_phone TEXT,
    link_token TEXT, revoked_tokens JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS circles_token_idx ON circles(link_token)`;

  await sql`CREATE TABLE IF NOT EXISTS committees (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS supervisors (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL, display_name TEXT,
    password_hash TEXT NOT NULL,
    committee_id INTEGER REFERENCES committees(id) ON DELETE SET NULL,
    can_edit_records BOOLEAN NOT NULL DEFAULT TRUE,
    can_delete_records BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS supervisors_username_idx ON supervisors(username)`;

  await sql`CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL,
    national_id TEXT, parent_phone TEXT, level TEXT,
    circle_id INTEGER REFERENCES circles(id) ON DELETE SET NULL,
    committee_id INTEGER REFERENCES committees(id) ON DELETE SET NULL,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting_hizbs',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS students_circle_idx ON students(circle_id)`;
  await sql`CREATE INDEX IF NOT EXISTS students_committee_idx ON students(committee_id)`;
  await sql`CREATE INDEX IF NOT EXISTS students_status_idx ON students(status)`;

  await sql`CREATE TABLE IF NOT EXISTS student_hizbs (
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    hizb_number INTEGER NOT NULL,
    PRIMARY KEY (student_id, hizb_number)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    committee_id INTEGER REFERENCES committees(id) ON DELETE SET NULL,
    hizb_number INTEGER NOT NULL,
    reciter_name TEXT NOT NULL,
    device_tag TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP, duration_seconds INTEGER,
    errors INTEGER NOT NULL DEFAULT 0,
    alerts INTEGER NOT NULL DEFAULT 0,
    score INTEGER, passed BOOLEAN,
    cancelled BOOLEAN NOT NULL DEFAULT FALSE
  )`;
  await sql`CREATE INDEX IF NOT EXISTS sessions_student_idx ON sessions(student_id)`;
  await sql`CREATE INDEX IF NOT EXISTS sessions_committee_idx ON sessions(committee_id)`;
  await sql`CREATE INDEX IF NOT EXISTS sessions_active_idx ON sessions(ended_at)`;
  await sql`CREATE INDEX IF NOT EXISTS sessions_date_idx ON sessions(started_at)`;

  // Legacy attendance (may still exist from v1)
  await sql`CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    committee_id INTEGER REFERENCES committees(id) ON DELETE SET NULL,
    date TEXT, status TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;

  // --- v2: programs system ---
  await sql`CREATE TABLE IF NOT EXISTS programs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS programs_active_idx ON programs(is_active)`;

  // Ensure at least one active program exists
  const activeRows = await sql`SELECT id FROM programs WHERE is_active = TRUE AND archived_at IS NULL LIMIT 1`;
  if (activeRows.length === 0) {
    const existingNonArchived = await sql`SELECT id FROM programs WHERE archived_at IS NULL ORDER BY id LIMIT 1`;
    if (existingNonArchived.length > 0) {
      await sql`UPDATE programs SET is_active = TRUE WHERE id = ${existingNonArchived[0].id}`;
    } else {
      await sql`INSERT INTO programs (name, is_active) VALUES ('البرنامج الحالي', TRUE)`;
    }
  }

  // sessions.program_id
  await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL`;
  await sql`CREATE INDEX IF NOT EXISTS sessions_program_idx ON sessions(program_id)`;

  // Backfill: assign existing sessions to the active program
  const activeAfter = await sql`SELECT id FROM programs WHERE is_active = TRUE LIMIT 1`;
  const activeId = activeAfter[0]?.id;
  if (activeId) {
    await sql`UPDATE sessions SET program_id = ${activeId} WHERE program_id IS NULL`;
  }

  // Rebuild attendance for program scoping:
  // 1) Add program_id column (nullable at first for backfill)
  await sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE`;
  // 2) Add updated_at
  await sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`;
  // 3) Backfill program_id
  if (activeId) {
    await sql`UPDATE attendance SET program_id = ${activeId} WHERE program_id IS NULL`;
  }
  // 4) Normalize legacy statuses (late -> absent to fit new 3-state model)
  await sql`UPDATE attendance SET status = 'absent' WHERE status = 'late'`;
  // 5) Deduplicate old daily rows down to one per (student, program) — keep newest
  await sql`
    DELETE FROM attendance a
    USING attendance b
    WHERE a.student_id = b.student_id
      AND a.program_id = b.program_id
      AND a.id < b.id
  `;
  // 6) Make program_id NOT NULL + add unique constraint
  await sql`ALTER TABLE attendance ALTER COLUMN program_id SET NOT NULL`;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_student_program_uq') THEN
        ALTER TABLE attendance ADD CONSTRAINT attendance_student_program_uq UNIQUE (student_id, program_id);
      END IF;
    END $$;
  `;
  await sql`CREATE INDEX IF NOT EXISTS attendance_program_idx ON attendance(program_id)`;
  // 7) `date` and `created_at` kept nullable for backward compatibility; new rows will not set them.
  // Ensure legacy `date` column is NULLABLE (old v1 deploys may have NOT NULL)
  try {
    await sql`ALTER TABLE attendance ALTER COLUMN date DROP NOT NULL`;
  } catch (e) { /* ok if already nullable or column doesn't exist */ }
  try {
    await sql`ALTER TABLE attendance ALTER COLUMN created_at DROP NOT NULL`;
  } catch (e) { /* ok */ }

  console.log('[sard] migrate complete (v2 programs)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
