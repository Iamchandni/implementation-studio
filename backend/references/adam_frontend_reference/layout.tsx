import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'EZIO — Enterprise Agent Control Plane',
  description: 'Build, govern and operate enterprise AI agents. By Brillio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No-flash theme init — runs before React hydrates, applies dark class based on
  // stored preference (or system if none). Keeps SSR-safe.
  const themeInit = `
    (function() {
      try {
        var raw = localStorage.getItem('acp-ui');
        var pref = 'dark';
        if (raw) {
          var parsed = JSON.parse(raw);
          pref = (parsed && parsed.state && parsed.state.theme) || 'dark';
        }
        var effective = pref === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : pref;
        if (effective === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      } catch (e) {
        document.documentElement.classList.add('dark');
      }
    })();
  `;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Load Outfit via a plain <link> so the browser fetches it directly.
            Server-side next/font/google can fail on corporate networks with
            SSL inspection because Node uses its own cert store. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
