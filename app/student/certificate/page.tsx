import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { students, studentHizbs, sessions, settings } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getActiveProgram } from '@/lib/activeProgram';
import PrintButton from './PrintButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export default async function CertificatePage() {
  const s = await getSession();
  if (!s || s.role !== 'student' || !s.id) redirect('/');
  const studentId = s.id;

  const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!student) redirect('/');

  const [set] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const program = await getActiveProgram();

  const hs = await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, studentId));
  const target = hs.length;

  const passedRows = await db
    .select({ hizbNumber: sessions.hizbNumber })
    .from(sessions)
    .where(and(eq(sessions.studentId, studentId), eq(sessions.passed, true), eq(sessions.cancelled, false)));
  const memorized = new Set(passedRows.map((r) => r.hizbNumber)).size;
  const completion = target > 0 ? Math.round((memorized / target) * 100) : 0;

  // Block: no certificate for students with zero progress
  if (memorized === 0 || completion === 0) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="u-card" style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            لا يمكن إصدار الشهادة
          </h1>
          <p className="u-muted" style={{ marginBottom: 16, lineHeight: 1.7 }}>
            لا يمكن إصدار الشهادة قبل اجتياز حزب واحد على الأقل. ارجع للصفحة الرئيسية وتابع تسميعك.
          </p>
          <a href="/student" className="u-btn u-btn-p" style={{ textDecoration: 'none' }}>رجوع للصفحة</a>
        </div>
      </main>
    );
  }

  const bgUrl = set?.certificateBgUrl || null;
  const inst = set?.institutionName || 'مجمع تحفيظ القرآن الكريم';

  const today = new Date();
  const dateStr = `${AR_DAYS[today.getDay()]}، ${today.getDate()} ${AR_MONTHS[today.getMonth()]} ${today.getFullYear()}`;

  // Always-white text with a shadow — reads on both custom bg images and the brand fallback gradient.
  const textShadow = bgUrl ? '0 2px 8px rgba(0,0,0,0.5)' : '0 1px 3px rgba(0,0,0,0.65)';
  const subtleShadow = bgUrl ? '0 1px 4px rgba(0,0,0,0.4)' : '0 1px 2px rgba(0,0,0,0.5)';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: A4 portrait; margin: 0; }
        html, body { margin: 0; padding: 0; background: #e5e7eb; }
        .cert-page { min-height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding: 16px; }
        .cert-topbar {
          position: fixed; left: 12px; right: 12px; z-index: 5;
          top: calc(12px + env(safe-area-inset-top));
          display: flex; justify-content: space-between; gap: 8px; pointer-events: none;
        }
        .cert-topbar > * { pointer-events: auto; }
        .cert {
          position: relative;
          width: 210mm;
          min-height: 297mm;
          background: ${bgUrl ? `url("${bgUrl}") center/cover no-repeat` : 'linear-gradient(135deg, #013856 0%, #09598E 55%, #0B3B5C 100%)'};
          color: #ffffff;
          box-shadow: 0 10px 40px rgba(0,0,0,.2);
          overflow: hidden;
          font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
        }
        .cert::before {
          content: '';
          position: absolute; inset: 24px;
          border: 3px double #d4af37;
          border-radius: 12px;
          pointer-events: none;
        }
        .cert-body {
          position: absolute; inset: 60px;
          display: flex; flex-direction: column; align-items: center;
          text-align: center;
          gap: 10px;
          padding: 40px 32px;
          border-radius: 8px;
        }
        .cert-ornament { color: #d4af37; margin: 0 auto 4px; filter: drop-shadow(0 2px 4px rgba(0,0,0,.4)); }
        .cert-inst { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0; text-shadow: ${textShadow}; }
        .cert-title { font-size: 48px; font-weight: 900; color: #ffffff; margin: 24px 0 4px; letter-spacing: -1px; text-shadow: ${textShadow}; }
        .cert-subtitle { font-size: 18px; color: rgba(255,255,255,.92); margin: 0 0 32px; text-shadow: ${subtleShadow}; }
        .cert-granted { font-size: 16px; color: #ffffff; margin: 8px 0; text-shadow: ${subtleShadow}; }
        .cert-name { font-size: 54px; font-weight: 900; color: #e3c170; margin: 12px 0 24px; letter-spacing: -1px; line-height: 1.1; text-shadow: 0 2px 6px rgba(0,0,0,.45); }
        .cert-program {
          font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 32px;
          padding: 8px 20px; border-radius: 99px;
          background: rgba(1,56,86,.55); border: 1px solid rgba(255,255,255,.3);
          display: inline-block; text-shadow: ${subtleShadow};
        }
        .cert-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; width: 100%; margin: 24px 0; }
        .cert-stat {
          padding: 20px 12px; border-radius: 16px;
          border: 1.5px solid rgba(255,255,255,.35);
          background: rgba(0,0,0,.25);
          backdrop-filter: blur(2px);
        }
        .cert-stat-v { font-size: 36px; font-weight: 900; color: #ffffff; line-height: 1; font-variant-numeric: tabular-nums; text-shadow: ${textShadow}; }
        .cert-stat-l { font-size: 13px; color: rgba(255,255,255,.9); margin-top: 6px; font-weight: 600; text-shadow: ${subtleShadow}; }
        .cert-foot { position: absolute; left: 60px; right: 60px; bottom: 80px; display: flex; justify-content: space-between; align-items: end; font-size: 13px; color: rgba(255,255,255,.9); text-shadow: ${subtleShadow}; }
        .cert-sig { text-align: center; }
        .cert-sig-line { width: 180px; border-top: 1.5px solid rgba(255,255,255,.75); margin: 32px auto 4px; }
        .cert-sig-lbl { font-weight: 700; color: #ffffff; text-shadow: ${subtleShadow}; }
        .back-btn { text-decoration: none; }
        @media print {
          body, html { background: #fff !important; }
          .cert-page { padding: 0 !important; }
          .cert-topbar { display: none !important; }
          .cert { box-shadow: none !important; width: 210mm; min-height: 297mm; }
        }
      `}} />
      <div className="cert-topbar">
        <a href="/student" className="u-btn u-btn-g back-btn">
          <span>←</span><span>رجوع</span>
        </a>
        <PrintButton />
      </div>
      <div className="cert-page">
        <div className="cert">
          <div className="cert-body">
            <svg className="cert-ornament" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" />
            </svg>
            <h2 className="cert-inst">{inst}</h2>

            <h1 className="cert-title">شهادة إتمام</h1>
            <p className="cert-subtitle">بسم الله الرحمن الرحيم</p>

            <p className="cert-granted">تُمنح هذه الشهادة إلى الطالب</p>
            <h3 className="cert-name">{student.name}</h3>

            {program && <div className="cert-program">ضمن برنامج: {program.name}</div>}

            <div className="cert-stats">
              <div className="cert-stat">
                <div className="cert-stat-v">{memorized}</div>
                <div className="cert-stat-l">الأحزاب المحفوظة</div>
              </div>
              <div className="cert-stat">
                <div className="cert-stat-v">{target}</div>
                <div className="cert-stat-l">الهدف المحدد</div>
              </div>
              <div className="cert-stat">
                <div className="cert-stat-v">{completion}%</div>
                <div className="cert-stat-l">نسبة الإنجاز</div>
              </div>
            </div>
          </div>

          <div className="cert-foot">
            <div>
              <div>{dateStr}</div>
            </div>
            <div className="cert-sig">
              <div className="cert-sig-line" />
              <div className="cert-sig-lbl">إدارة المجمع</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
