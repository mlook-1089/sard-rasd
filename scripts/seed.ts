import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const sql = neon(url);

  const existing = await sql`SELECT id FROM settings WHERE id = 1`;
  if (existing.length > 0) {
    console.log('[sard] already seeded');
    return;
  }

  const adminHash = await bcrypt.hash('admin123', 10);
  const reciterHash = await bcrypt.hash('reciter123', 10);

  await sql`INSERT INTO settings (
      id, institution_name, honor_labels, whatsapp_template,
      admin_password_hash, reciter_password_hash
    ) VALUES (
      1,
      'مجمع تحفيظ القرآن الكريم',
      ${JSON.stringify({
        hizbs: 'الأحزاب المنجزة',
        pages: 'الأوجه المقروءة',
        circles: 'عدد الحلقات',
        students: 'عدد الطلاب',
        completion: 'نسبة الإنجاز',
        sessions: 'جلسات التسميع'
      })}::jsonb,
      'السلام عليكم ورحمة الله\nتقرير الطالب {name}\nالمنجز: {memorized} / {hizbs}\nالأخطاء: {errors} | التنبيهات: {alerts}\nنسبة الإنجاز: {completion}%',
      ${adminHash},
      ${reciterHash}
    )`;

  // Demo circles & committee so you can click around on first run.
  await sql`INSERT INTO circles (name, teacher_name) VALUES ('حلقة حمزة','المعلم أحمد')`;
  await sql`INSERT INTO circles (name, teacher_name) VALUES ('حلقة الزبير','المعلم محمد')`;
  await sql`INSERT INTO committees (name) VALUES ('اللجنة 1')`;

  console.log('[sard] seed complete. admin password = admin123, reciter password = reciter123');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
