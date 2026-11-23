import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  primaryKey,
  index,
  boolean,
  jsonb,
  unique
} from 'drizzle-orm/pg-core';

// ----- Singleton settings row (id = 1) -----
export const settings = pgTable('settings', {
  id: integer('id').primaryKey(),
  institutionName: text('institution_name').default('مجمع تحفيظ القرآن الكريم').notNull(),
  logoUrl: text('logo_url'),
  subLogoUrl: text('sub_logo_url'),
  loginImageUrl: text('login_image_url'),
  certificateBgUrl: text('certificate_bg_url'),
  totalScore: integer('total_score').default(100).notNull(),
  passThreshold: integer('pass_threshold').default(60).notNull(),
  errorDeduction: integer('error_deduction').default(2).notNull(),
  alertDeduction: integer('alert_deduction').default(1).notNull(),
  slowSessionMinutes: integer('slow_session_minutes').default(5).notNull(),
  stuckSessionMinutes: integer('stuck_session_minutes').default(10).notNull(),
  honorLabels: jsonb('honor_labels').$type<Record<string, string>>().default({
    hizbs: 'الأحزاب المنجزة',
    pages: 'الأوجه المقروءة',
    circles: 'عدد الحلقات',
    students: 'عدد الطلاب',
    completion: 'نسبة الإنجاز',
    sessions: 'جلسات التسميع'
  }),
  whatsappTemplate: text('whatsapp_template').default(
    'السلام عليكم ورحمة الله\nتقرير الطالب {name}\nالمحفوظ: {memorized} / {hizbs}\nالأخطاء: {errors} | التنبيهات: {alerts}\nنسبة الإنجاز: {completion}%'
  ).notNull(),
  adminPasswordHash: text('admin_password_hash').notNull(),
  reciterPasswordHash: text('reciter_password_hash').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ----- Programs (برامج السرد) -----
// Only ONE program is active at a time (is_active=true). Others are archived
// (archived_at NOT NULL) but their sessions/attendance remain for reporting.
export const programs = pgTable('programs', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  activeIdx: index('programs_active_idx').on(t.isActive)
}));

// ----- Circles (الحلقات) -----
export const circles = pgTable('circles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  teacherName: text('teacher_name'),
  teacherPhone: text('teacher_phone'),
  linkToken: text('link_token'),
  revokedTokens: jsonb('revoked_tokens').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  tokenIdx: index('circles_token_idx').on(t.linkToken)
}));

// ----- Committees (اللجان) -----
export const committees = pgTable('committees', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  // Capacity constraints — used by the smart auto-assign feature.
  maxStudents: integer('max_students'),      // nullable = no cap
  minStudents: integer('min_students'),      // nullable = no floor
  maxHizbs: integer('max_hizbs'),            // sum of assigned hizbs across students
  minHizbs: integer('min_hizbs'),
  // Diversity cap: no single circle can contribute more than N students to this committee
  maxPerCircle: integer('max_per_circle'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ----- Supervisors (مشرفو اللجان) -----
export const supervisors = pgTable('supervisors', {
  id: serial('id').primaryKey(),
  username: text('username').notNull(),
  displayName: text('display_name'),
  passwordHash: text('password_hash').notNull(),
  committeeId: integer('committee_id').references(() => committees.id, { onDelete: 'set null' }),
  canEditRecords: boolean('can_edit_records').default(true).notNull(),
  canDeleteRecords: boolean('can_delete_records').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  usernameIdx: index('supervisors_username_idx').on(t.username)
}));

// ----- Students (الطلاب) -----
// status: waiting_hizbs | waiting_committee | active
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  nationalId: text('national_id'),
  parentPhone: text('parent_phone'),
  level: text('level'),
  circleId: integer('circle_id').references(() => circles.id, { onDelete: 'set null' }),
  committeeId: integer('committee_id').references(() => committees.id, { onDelete: 'set null' }),
  passwordHash: text('password_hash').notNull(),
  status: text('status').default('waiting_hizbs').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  circleIdx: index('students_circle_idx').on(t.circleId),
  committeeIdx: index('students_committee_idx').on(t.committeeId),
  statusIdx: index('students_status_idx').on(t.status)
}));

// ----- Student assigned hizbs (which of 1..60 a student must recite) -----
export const studentHizbs = pgTable('student_hizbs', {
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  hizbNumber: integer('hizb_number').notNull(),
  // Set by the administration through the mandatory-hizbs import. Teachers can
  // add assignments, but can never remove an already assigned hizb.
  isMandatory: boolean('is_mandatory').default(false).notNull()
}, (t) => ({
  pk: primaryKey({ columns: [t.studentId, t.hizbNumber] })
}));

// ----- Recitation sessions -----
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  committeeId: integer('committee_id').references(() => committees.id, { onDelete: 'set null' }),
  programId: integer('program_id').references(() => programs.id, { onDelete: 'set null' }),
  hizbNumber: integer('hizb_number').notNull(),
  reciterName: text('reciter_name').notNull(),
  deviceTag: text('device_tag'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  durationSeconds: integer('duration_seconds'),
  errors: integer('errors').default(0).notNull(),
  alerts: integer('alerts').default(0).notNull(),
  score: integer('score'),
  passed: boolean('passed'),
  cancelled: boolean('cancelled').default(false).notNull()
}, (t) => ({
  studentIdx: index('sessions_student_idx').on(t.studentId),
  committeeIdx: index('sessions_committee_idx').on(t.committeeId),
  programIdx: index('sessions_program_idx').on(t.programId),
  activeIdx: index('sessions_active_idx').on(t.endedAt),
  dateIdx: index('sessions_date_idx').on(t.startedAt)
}));

// ----- Attendance (التحضير بلا تاريخ) -----
// One row per (student, program). Status cycles: unset -> present -> absent -> unset.
// No date — this is a snapshot of engagement within the program.
export const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  programId: integer('program_id').notNull().references(() => programs.id, { onDelete: 'cascade' }),
  committeeId: integer('committee_id').references(() => committees.id, { onDelete: 'set null' }),
  status: text('status').default('unset').notNull(), // present | absent | unset
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (t) => ({
  uniq: unique('attendance_student_program_uq').on(t.studentId, t.programId),
  programIdx: index('attendance_program_idx').on(t.programId)
}));

export type Settings = typeof settings.$inferSelect;
export type Circle = typeof circles.$inferSelect;
export type Committee = typeof committees.$inferSelect;
export type Supervisor = typeof supervisors.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type Program = typeof programs.$inferSelect;
