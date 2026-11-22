import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'منصة رصد — برنامج السرد',
  description: 'منصة تتبع إنجاز طلاب تحفيظ القرآن الكريم',
  themeColor: '#013856'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="رصد السرد" />

        {/* Plex Arabic + Tajawal — same as ibn-kathir */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@400;500;700;800;900&display=swap"
          rel="stylesheet"
        />

        {/* Tailwind Play CDN — same approach as ibn-kathir prior to compilation. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.tailwind = window.tailwind || {};
window.tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {DEFAULT:'#013856', deep:'#002B49', light:'#09598E',
                50:'#F0F4F8', 100:'#DBE7EF', 400:'#09598E', 500:'#013856', 600:'#013856', 700:'#002B49', 800:'#002B49', 900:'#013856'},
        gold: {100:'#fcf6e3',400:'#e6c05a',500:'#d4af37',600:'#b5952f',700:'#8a6b1e'},
        accent: {300:'#f5d78a',400:'#e6c05a',500:'#d4af37',600:'#b89129',700:'#8a6b1e'},
        pass: {DEFAULT:'#1B7F4B', bg:'#E2F0E8'},
        fail: {DEFAULT:'#B03038', bg:'#F8E5E6'},
        paper: '#EFF3F7',
        success: '#1B7F4B', danger: '#B03038', surface: '#F9FAFB'
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Tajawal', 'sans-serif'],
        title: ['Tajawal', 'IBM Plex Sans Arabic', 'sans-serif']
      },
      borderRadius: { '3xl': '1.5rem', '4xl': '2rem' }
    }
  }
};`
          }}
        />
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
