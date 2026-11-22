# منصة رصد — برنامج السرد

منصة ويب عربية (RTL) لتتبع إنجاز طلاب تحفيظ القرآن الكريم.

**الرابط الحي:** https://sard-rasd.vercel.app
**لوحة Vercel:** https://vercel.com/sfsr19-3170s-projects/sard-rasd

---

## للعمل مع وكيل خارجي (External Agent Onboarding)

إذا كنت وكيلاً خارجياً تعمل على هذا المشروع لأول مرة، اقرأ هذا القسم كاملاً قبل أي شيء.

### ما تحتاجه
| الشيء | مصدره |
|---|---|
| **المشروع** | هذا المجلد كاملاً (بدون `node_modules` و `.next`) |
| **Vercel Token** | يعطيك إياه صاحب المشروع (أنشئه من https://vercel.com/account/tokens بصلاحية Full Account أو Project-specific لمشروع `sard-rasd`) |
| **DATABASE_URL** | من `.env.local` (محلياً) أو من https://console.neon.tech — يبدأ بـ `postgresql://neondb_owner:...` |
| **SESSION_SECRET** | قيمة موجودة في `.env.local` — لا تولّد جديدة، فهذا يُلغي كل الـ cookies الحالية |

### خطوات أول تشغيل محلي
```powershell
# 1) تثبيت الاعتماديات (مرة واحدة)
npm install

# 2) تأكد من وجود .env.local بالقيم الصحيحة (اطلبها من صاحب المشروع):
#    DATABASE_URL=postgresql://...
#    SESSION_SECRET=48 حرف عشوائي

# 3) إذا عدّلت الـ schema (lib/schema.ts) شغّل migrate:
npm run db:migrate

# 4) التجربة محلياً:
npm run dev
# افتح http://localhost:3000
```

### نشر التحديثات

**الطريقة الموصى بها (GitHub auto-deploy):**
الريبو على https://github.com/mlook-1089/sard-rasd مربوط بـ Vercel.
أي `git push` على فرع `main` ينشر تلقائياً خلال دقيقتين. أي `git push` على فرع آخر أو PR ينشئ Preview Deployment برابط خاص.

```powershell
# بعد أي تعديل
git add .
git commit -m "وصف التعديل"
git push
```

**الطريقة اليدوية (fallback فقط إذا تعطّل GitHub):**
```powershell
$env:VERCEL_TOKEN="<توكن-الذي-أعطاه-لك-صاحب-المشروع>"
$env:NODE_OPTIONS="--require ./shim-hostname.js"
npx vercel@latest deploy --prod --yes --token=$env:VERCEL_TOKEN
```
أو `.\deploy.bat` بعد `setx VERCEL_TOKEN "<التوكن>"`.

### دورة عمل الوكيل الخارجي
1. اطلب من صاحب المشروع إضافتك كـ Collaborator على https://github.com/mlook-1089/sard-rasd/settings/access
2. `git clone https://github.com/mlook-1089/sard-rasd.git`
3. اطلب قيم `.env.local` (DATABASE_URL + SESSION_SECRET) في قناة آمنة
4. أنشئ branch: `git checkout -b my-fix`
5. عدّل → commit → `git push -u origin my-fix`
6. افتح Pull Request على GitHub
7. Vercel يُنشئ Preview Deployment تلقائياً — رابطه على PR
8. صاحب المشروع يراجع ويدمج → النشر للـ production تلقائي

### فخاخ حرجة لازم تعرفها

1. **اسم جهاز صاحب المشروع عربي (`سحاب`)** → أي أمر `vercel` بدون shim يرمي:
   ```
   TypeError: ByteString contains non-Latin-1 chars
   ```
   **الحل:** `NODE_OPTIONS=--require ./shim-hostname.js` قبل كل أمر vercel. `deploy.bat` يفعل ذلك تلقائياً.

2. **لا تستخدم `vercel login`** — لن يعمل بسبب نفس المشكلة. استخدم `--token` فقط.

3. **PowerShell يُفسد متغيرات البيئة المحتوية على `&`**:
   ```powershell
   # ❌ خطأ (يقطع عند &):
   echo $env:DATABASE_URL | vercel env add ...
   ```
   **الحل:** استخدم Git Bash مع ملف وسيط:
   ```bash
   printf 'postgresql://user:pass@host/db?sslmode=require&channel_binding=require' > /tmp/dburl.txt
   cat /tmp/dburl.txt | npx vercel@latest env add DATABASE_URL production --token=$VERCEL_TOKEN --yes
   rm /tmp/dburl.txt
   ```
   أو أضف المتغير يدوياً من لوحة Vercel.

4. **المسار يجب أن يكون ASCII فقط** — لا تنقل المشروع إلى مجلد اسمه عربي، سيفشل Vercel CLI.

5. **إذا غيّرت schema** (`lib/schema.ts`)، شغّل `npm run db:migrate` على جهازك قبل النشر — Vercel لا يشغّل migrations تلقائياً.

6. **تحقق من النشر بعد كل deploy:**
   ```powershell
   curl -s -X POST https://sard-rasd.vercel.app/api/login `
     -H "content-type: application/json" `
     -d '{\"password\":\"admin123\"}' -i | Select-Object -First 5
   ```
   يجب أن ترى `HTTP/1.1 200 OK` مع `Set-Cookie: sard_session=...`.

### إذا فشل البناء
انظر السجلات:
```powershell
npx vercel@latest inspect <deployment-url> --logs --token=$env:VERCEL_TOKEN
```
أو من واجهة Vercel مباشرة.

---

## التقنيات

- **Framework:** Next.js 14.2.35 (App Router) + TypeScript
- **DB:** Neon Postgres (serverless) + Drizzle ORM
- **Auth:** JWT في cookie httpOnly (`jose`) + `bcryptjs`
- **UI:** Tailwind Play CDN + نظام تصميم مخصص (`app/globals.css` بـ `u-*` components من ibn-kathir)
- **Fonts:** IBM Plex Sans Arabic + Tajawal (من Google Fonts)
- **Export:** SheetJS (`xlsx`) للتقارير
- **Hosting:** Vercel

## بنية المشروع

```
app/
  ├── layout.tsx                 # Root layout (RTL, fonts, Tailwind CDN)
  ├── page.tsx                   # شاشة الدخول الموحّدة
  ├── globals.css                # نظام التصميم (u-* classes + CSS variables)
  ├── not-found.tsx              # صفحة 404 عربية
  ├── admin/                     # بوابة المدير (محمية بـ layout)
  │   ├── page.tsx               # لوحة KPIs + Live sessions
  │   ├── students/              # إدارة الطلاب + Edit modal + استيراد xlsx
  │   ├── circles/               # الحلقات + روابط المعلمين
  │   ├── committees/
  │   ├── programs/              # برامج السرد (تفعيل/أرشفة)
  │   ├── users/                 # مشرفو اللجان + حساب المسمع المشترك
  │   ├── waiting-hizbs/ waiting-committee/   # تدفقات القبول
  │   ├── attendance/            # التحضير (click-to-save)
  │   ├── sessions/              # سجل الرصد الشامل
  │   ├── reports/students/ reports/circles/  # تقارير + تصدير xlsx
  │   └── settings/              # إعدادات (الدرجات، واتساب، شعار)
  ├── supervisor/                # بوابة مشرف اللجنة
  ├── reciter/                   # بوابة المسمع المشترك
  ├── student/                   # بوابة الطالب + شهادة PDF
  ├── teacher/[token]/           # بوابة معلم الحلقة (رابط خاص)
  ├── honor/                     # لوحة الشرف التلفزيونية (عامة)
  └── api/                       # REST endpoints
      ├── login/ logout/ me/
      ├── students/ circles/ committees/ programs/ supervisors/
      ├── sessions/ attendance/
      ├── teacher/[token]/
      ├── reports/students/ reports/circles/ reports/sessions/  # xlsx
      └── public/honor/ public/student/

components/
  ├── AppShell.tsx               # Sidebar (desktop) + Bottom nav (mobile)
  ├── LiveSessionsPanel.tsx      # Live timer widget (admin + supervisor)
  ├── RecordFlow.tsx             # محرك التسميع (4 خطوات + ± counters)
  ├── ActiveProgramBanner.tsx    # شريط البرنامج النشط
  ├── ExportButton.tsx
  └── icons.tsx                  # SVG icons (shared, server-safe)

lib/
  ├── db.ts                      # Lazy Drizzle client
  ├── schema.ts                  # كل الجداول
  ├── auth.ts                    # JWT + bcrypt + password helpers
  ├── require.ts                 # role guards
  ├── grading.ts                 # صيغة الدرجة
  ├── activeProgram.ts           # getActiveProgram()
  ├── xlsx.ts                    # xlsx export/import
  └── csv.ts                     # CSV import fallback

scripts/
  ├── migrate.ts                 # idempotent schema creator
  └── seed.ts                    # بذور افتراضية

shim-hostname.js                 # يُجبر os.hostname() على قيمة ASCII (للـ Vercel CLI)
deploy.bat                       # نشر بنقرة واحدة
```

## الأدوار والمسارات

| الدور | المسار | الدخول |
|-------|--------|--------|
| **المدير** | `/admin/*` | كلمة مرور المدير (`settings.admin_password_hash`) |
| **مشرف لجنة** | `/supervisor/*` | كلمة مرور في `supervisors` |
| **المسمع** | `/reciter/*` | كلمة مرور مشتركة (`settings.reciter_password_hash`) + اختيار لجنة + اسم لكل جهاز |
| **الطالب/ولي الأمر** | `/student` | كلمة مرور في `students` (كل طالب كلمة مرور خاصة) |
| **معلم الحلقة** | `/teacher/[token]` | رابط خاص (`circles.link_token`) — بدون تسجيل دخول |
| **لوحة الشرف** | `/honor` | عام — لا يحتاج دخول |
| **صفحة الشهادة** | `/student/certificate` | محمية بـ session الطالب |

**مبدأ الدخول:** شاشة دخول واحدة في `/`، كلمة المرور نفسها تحدد الدور (admin → `/admin`، supervisor → `/supervisor` على لجنته، إلخ).

## قاعدة البيانات (Drizzle schema in `lib/schema.ts`)

- **`settings`** (singleton id=1): كلمات المرور، الدرجات، قالب واتساب، تسميات لوحة الشرف، شعار، خلفية الشهادة
- **`programs`**: برامج السرد (نشط واحد + أرشيف)
- **`circles`**: الحلقات مع `link_token` + `revoked_tokens` JSONB
- **`committees`**
- **`supervisors`**: مشرفو اللجان (username + password + صلاحيات)
- **`students`**: مع `status` enum: `waiting_hizbs` | `waiting_committee` | `active`
- **`student_hizbs`**: composite PK (student_id, hizb_number) — الأحزاب المطلوبة
- **`sessions`**: جلسات التسميع مع `program_id`, `started_at`, `ended_at`, `duration_seconds`, `score`, `passed`, `cancelled`, `device_tag`
- **`attendance`**: حالة واحدة لكل (student × program) — unique constraint `attendance_student_program_uq`

### Migration policy
`scripts/migrate.ts` **idempotent بالكامل**: يمكن تشغيله بأمان عدة مرات. يتعامل مع:
- إضافة الأعمدة الجديدة إن لم توجد
- تحويل جدول attendance من YYYY-MM-DD إلى program-scoped
- إسقاط NOT NULL عن الأعمدة القديمة (`date`, `created_at`)
- إنشاء برنامج افتراضي "البرنامج الحالي" إذا لم يوجد أي برنامج نشط

## نقاط تقنية مهمة

- **مؤقت الجلسة**: الـ API يُرجع `startedAt`، العميل يحسب المدة محلياً كل ثانية + polling كل 10ث.
- **منع التسميع المكرر**: `/api/sessions` POST يرفض بدء جلسة إذا سبق **الاجتياز** (passed=true) — لكن يسمح بإعادة تسميع **الراسب**.
- **منع double-click**: `/api/sessions` POST يرفض إنشاء جلسة ثانية مفتوحة لنفس (student, hizb).
- **الدرجة**: `max(0, total - errors*err_deduct - alerts*alert_deduct)` (في `lib/grading.ts`).
- **تصادم كلمة المرور**: كل إنشاء/تعديل يمر على `passwordCollides` ويرجع 409 عند التصادم.
- **device_tag للمسمع**: يُولّد تلقائياً ويُخزّن في `localStorage` مع كل جلسة. `/reciter/history` يفلتر به + اسم المسمع.
- **Live sessions ignore stale**: `/api/sessions/live` يتجاهل الجلسات المفتوحة الأقدم من ساعتين (orphan protection).
- **Cancelled sessions**: `/api/sessions` GET يخفيها افتراضياً — مرر `?includeCancelled=1` لإظهارها.
- **Attendance upsert**: SQL raw `ON CONFLICT (student_id, program_id) DO UPDATE` — يعمل حتى لو لم يوجد الـ unique constraint مُسمّى.
- **xlsx Arabic filenames**: استخدام RFC 5987 `filename*=UTF-8''...` + ASCII fallback (`students-report.xlsx`).
- **Honor API**: `cache: 'no-store'` + `Cache-Control: no-store, no-cache, must-revalidate` + cache-buster في fetch.
- **Teacher link revocation**: regenerate يضع الـ token القديم في `revoked_tokens` ويولّد جديداً. الـ page + API كلاهما يفحص الـ revoked list.

## نظام التصميم (`app/globals.css`)

مُقتبس من ibn-kathir — 500+ سطر من CSS variables + مكونات. الملخص:

- **Variables:** `--brand` (navy #0B3B5C)، `--gold` (#A8841F)، `--ok/warn/bad/info`، `--card/bg/line/ink`...
- **Buttons:** `u-btn` + `u-btn-p|s|g|ok|bad`. Modifiers: `.sm .lg .w`. Icon-only: `u-icon-btn`.
- **Cards:** `u-card`، hero: `u-hero`، stats: `u-stat`.
- **Lists:** `u-list > u-item`.
- **Fields:** `u-field > label + u-input`.
- **Pills:** `u-pill ok|warn|bad|info|gold|brand|mute`.
- **Layout:** `u-page`, `u-top`, `u-grid2.md4`, `u-grid3`.
- **Mobile:** `u-header` (hidden on desktop), `u-nav` (bottom nav), `u-sheet` (bottom sheet).

**مهم:** الـ CSS فيه remap تلقائي لأصناف Tailwind القديمة (`bg-white`, `text-gray-*`) إلى الـ variables. لا داعي لإعادة كتابة الأصناف — ما إن تضيف الـ CSS كاملاً حتى تتبناها الصفحات.

## الإضافة إلى Vercel من الصفر (إذا نقلت المشروع)

```bash
# 1) ربط المشروع
npx vercel@latest link --yes --project sard-rasd --token=$VERCEL_TOKEN

# 2) إضافة المتغيرات (عبر Git Bash + ملف وسيط)
printf '<DATABASE_URL>' > dburl.txt
cat dburl.txt | npx vercel@latest env add DATABASE_URL production --token=$VERCEL_TOKEN --yes

printf '<SESSION_SECRET>' > secret.txt
cat secret.txt | npx vercel@latest env add SESSION_SECRET production --token=$VERCEL_TOKEN --yes
rm dburl.txt secret.txt

# 3) أول نشر
NODE_OPTIONS="--require ./shim-hostname.js" npx vercel@latest deploy --prod --yes --token=$VERCEL_TOKEN

# 4) تعطيل Vercel Authentication (يدوياً من لوحة Vercel)
# افتح: https://vercel.com/<team>/<project>/settings/deployment-protection
# عطّل "Vercel Authentication" ليكون الموقع عاماً
```

## استكشاف الأخطاء الشائعة

| الخطأ | السبب | الحل |
|------|-------|------|
| `ByteString contains non-Latin-1 chars` | اسم الجهاز غير ASCII | `NODE_OPTIONS=--require ./shim-hostname.js` |
| `500 من /api/*` | DATABASE_URL أو SESSION_SECRET غير مضبوطة في Vercel | أضفها (انظر أعلاه) |
| الدخول يفشل بعد النشر | DB فارغة (لم يُشغَّل migrate+seed) | `npm run db:migrate && npm run db:seed` |
| Honor page أصفار | Cache قديم | التطبيق يستخدم no-store + cache-buster؛ جرب Ctrl+Shift+R |
| Attendance 500 | عمود `date` بقي NOT NULL من schema قديم | `npm run db:migrate` يُسقط NOT NULL تلقائياً |
| Build failure بسبب neon | `DATABASE_URL` غير متوفر وقت البناء | متغيرات production تكفي — تأكد أنها مضبوطة في Vercel |
| xlsx اسم ملف = `-_.xlsx` | متصفح لا يدعم RFC 5987 | نادر؛ الملف يُحمَّل باسم ASCII fallback (`students-report.xlsx`) |

## بيانات تجريبية (بعد `npm run db:seed`)

- **المدير:** `admin123`
- **المسمع المشترك:** `reciter123`

كلمات مرور المشرفين والطلاب تُنشأ لاحقاً من لوحة المدير.

## المشاركة مع وكيل خارجي — checklist

قبل أن تعطيه المشروع:
- [ ] أنشئ له **Vercel Token جديد** (لا تشارك الحالي)
- [ ] شارك قيمة `DATABASE_URL` و `SESSION_SECRET` في قناة آمنة (ليس git)
- [ ] تأكد أن `.env.local` ليس في git (موجود في `.gitignore`)
- [ ] اطلب منه قراءة هذا الملف قبل أي تعديل
- [ ] بعد انتهاء عمله: ألغِ الـ Token من https://vercel.com/account/tokens
