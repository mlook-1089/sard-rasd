# منصة رصد — برنامج السرد

منصة عربية لتتبع إنجاز طلاب تحفيظ القرآن الكريم.

للتفاصيل التقنية الكاملة والمسارات والنشر، اطلع على [CLAUDE.md](./CLAUDE.md).

## تشغيل سريع
```powershell
npm install
# ضع DATABASE_URL و SESSION_SECRET في .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

## كلمات المرور الافتراضية (بعد seed)
- المدير: `admin123`
- المسمع المشترك: `reciter123`
- لإنشاء طلاب ومشرفين: من بوابة المدير بعد الدخول.

<!-- auto-deploy test: 2026-11-22T17:37:28Z -->

<!-- retry test -->
