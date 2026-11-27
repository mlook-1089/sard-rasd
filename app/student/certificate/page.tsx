import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { students, studentHizbs, sessions, settings } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getActiveProgram } from '@/lib/activeProgram';
import PrintButton from './PrintButton';
import BrandLogo from '@/components/BrandLogo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export default async function CertificatePage() {
  const s = await getSession();
  if (!s || s.role !== 'student' || !s.id) redirect('/student/login');
  const studentId = s.id;

  const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!student) redirect('/student/login');

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
          <BrandLogo style={{ width: 240, margin: '0 auto 14px' }} />
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

  const textShadow = '0 2px 8px rgba(0,0,0,0.65)';
  const subtleShadow = '0 1px 4px rgba(0,0,0,0.55)';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: A4 portrait; margin: 0; }
        html, body { margin: 0; padding: 0; background: #e5e7eb; }
        .cert-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg, #e5e7eb);
        }
        .cert-topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: calc(10px + env(safe-area-inset-top)) 16px 10px;
          background: var(--card, #ffffff);
          border-bottom: 1px solid var(--line, #e5e7eb);
          box-shadow: 0 2px 8px rgba(15,27,45,0.06);
        }
        .cert-page {
          flex: 1;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 20px 16px 32px;
        }
        .cert {
          position: relative;
          width: 210mm;
          max-width: 100%;
          min-height: 297mm;
          background: ${bgUrl
            ? `linear-gradient(135deg, rgba(1, 40, 64, 0.84) 0%, rgba(9, 70, 114, 0.80) 55%, rgba(11, 45, 72, 0.86) 100%), url("${bgUrl}") center/cover no-repeat`
            : 'linear-gradient(135deg, #012a42 0%, #074773 55%, #09324f 100%)'} !important;
          color: #ffffff !important;
          box-shadow: 0 12px 40px rgba(0,0,0,.22);
          overflow: hidden;
          font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 60px;
          box-sizing: border-box;
          border-radius: 4px;
        }
        .cert * {
          color: inherit;
        }
        .cert::before {
          content: '';
          position: absolute;
          inset: 22px;
          border: 3px double #f5d061;
          border-radius: 12px;
          pointer-events: none;
        }
        .cert-body {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 10px;
          padding: 28px 24px;
          border-radius: 12px;
        }
        .cert-brand {
          width: 280px;
          max-width: 76%;
          margin: 0 auto 8px;
          padding: 11px 18px;
          border: 1.5px solid rgba(245,208,97,.75);
          border-radius: 15px;
          background: rgba(255,255,255,.96) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,.24);
        }
        .cert-brand .brand-logo { width: 100%; }
        .cert-inst { font-size: 21px; font-weight: 800; color: #ffffff !important; margin: 0; text-shadow: ${textShadow}; }
        .cert-title { font-size: 48px; font-weight: 900; color: #ffffff !important; margin: 20px 0 4px; letter-spacing: -1px; text-shadow: ${textShadow}; }
        .cert-subtitle { font-size: 18px; font-weight: 600; color: #f8fafc !important; margin: 0 0 28px; text-shadow: ${subtleShadow}; }
        .cert-granted { font-size: 17px; font-weight: 600; color: #ffffff !important; margin: 8px 0; text-shadow: ${subtleShadow}; }
        .cert-name { font-size: 50px; font-weight: 900; color: #fde047 !important; margin: 12px 0 24px; letter-spacing: -0.5px; line-height: 1.2; text-shadow: 0 2px 8px rgba(0,0,0,.6); }
        .cert-program {
          font-size: 18px; font-weight: 700; color: #ffffff !important; margin: 0 0 28px;
          padding: 8px 22px; border-radius: 99px;
          background: rgba(255,255,255,.14) !important; border: 1.5px solid rgba(245,208,97,.55);
          display: inline-block; text-shadow: ${subtleShadow};
        }
        .cert-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; width: 100%; margin: 20px 0; }
        .cert-stat {
          padding: 20px 12px; border-radius: 16px;
          border: 1.5px solid rgba(255,255,255,.4);
          background: rgba(0, 18, 32, 0.45) !important;
          backdrop-filter: blur(3px);
        }
        .cert-stat-v { font-size: 36px; font-weight: 900; color: #ffffff !important; line-height: 1.1; font-variant-numeric: tabular-nums; text-shadow: ${textShadow}; }
        .cert-stat-l { font-size: 13.5px; color: #f1f5f9 !important; margin-top: 6px; font-weight: 700; text-shadow: ${subtleShadow}; }
        .cert-foot {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          padding: 16px 12px 8px;
          font-size: 14px;
          font-weight: 600;
          color: #ffffff !important;
          text-shadow: ${subtleShadow};
        }
        .cert-sig { text-align: center; }
        .cert-sig-line { width: 180px; max-width: 40vw; border-top: 1.5px solid rgba(255,255,255,.85); margin: 28px auto 6px; }
        .cert-sig-lbl { font-weight: 800; color: #ffffff !important; text-shadow: ${subtleShadow}; }
        .back-btn { text-decoration: none; }
        @media (max-width: 767px) {
          .cert-page { padding: 12px; }
          .cert {
            width: 100%;
            min-height: auto;
            padding: 32px 20px 28px;
            border-radius: 14px;
          }
          .cert::before { inset: 12px; }
          .cert-body { padding: 16px 8px; }
          .cert-brand { width: 220px; max-width: 82%; padding: 8px 12px; border-radius: 12px; }
          .cert-inst { font-size: 17px; }
          .cert-title { font-size: 32px; margin: 12px 0 4px; }
          .cert-subtitle { font-size: 15px; margin-bottom: 18px; }
          .cert-name { font-size: 30px; margin: 8px 0 16px; }
          .cert-program { font-size: 14px; padding: 6px 14px; margin-bottom: 18px; }
          .cert-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
          .cert-stat { padding: 12px 6px; border-radius: 12px; }
          .cert-stat-v { font-size: 24px; }
          .cert-stat-l { font-size: 11.5px; }
          .cert-foot { margin-top: 20px; font-size: 12.5px; }
          .cert-sig-line { width: 120px; }
        }
        @media print {
          body, html, .cert-shell { background: #fff !important; }
          .cert-page { padding: 0 !important; }
          .cert-topbar { display: none !important; }
          .cert { box-shadow: none !important; width: 210mm !important; min-height: 297mm !important; padding: 60px !important; border-radius: 0 !important; }
        }
      `}} />
      <div className="cert-shell">
        <div className="cert-topbar">
          <a href="/student" className="u-btn u-btn-g back-btn">
            <span>←</span><span>رجوع</span>
          </a>
          <PrintButton />
        </div>
        <div className="cert-page">
          <div className="cert" style={{ color: '#ffffff' }}>
            <div className="cert-body">
              <div className="cert-brand"><BrandLogo /></div>
              <h2 className="cert-inst" style={{ color: '#ffffff' }}>{inst}</h2>

              <h1 className="cert-title" style={{ color: '#ffffff' }}>شهادة إتمام</h1>
              <p className="cert-subtitle" style={{ color: '#f8fafc' }}>بسم الله الرحمن الرحيم</p>

              <p className="cert-granted" style={{ color: '#ffffff' }}>تُمنح هذه الشهادة إلى الطالب</p>
              <h3 className="cert-name" style={{ color: '#fde047' }}>{student.name}</h3>

              {program && <div className="cert-program" style={{ color: '#ffffff' }}>ضمن برنامج: {program.name}</div>}

              <div className="cert-stats">
                <div className="cert-stat">
                  <div className="cert-stat-v" style={{ color: '#ffffff' }}>{memorized}</div>
                  <div className="cert-stat-l" style={{ color: '#f1f5f9' }}>الأحزاب المنجزة</div>
                </div>
                <div className="cert-stat">
                  <div className="cert-stat-v" style={{ color: '#ffffff' }}>{target}</div>
                  <div className="cert-stat-l" style={{ color: '#f1f5f9' }}>الهدف المحدد</div>
                </div>
                <div className="cert-stat">
                  <div className="cert-stat-v" style={{ color: '#ffffff' }} dir="ltr">{completion}%</div>
                  <div className="cert-stat-l" style={{ color: '#f1f5f9' }}>نسبة الإنجاز</div>
                </div>
              </div>
            </div>

            <div className="cert-foot" style={{ color: '#ffffff' }}>
              <div>
                <div style={{ color: '#ffffff' }}>{dateStr}</div>
              </div>
              <div className="cert-sig">
                <div className="cert-sig-line" />
                <div className="cert-sig-lbl" style={{ color: '#ffffff' }}>إدارة المجمع</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
