import React from 'react';
import type { Viewport } from 'next';
import './globals.css';
import { LocaleProvider } from '@/lib/i18n';
import { LocaleLang } from '@/components/LocaleLang';
import { ThemeProvider, themeInitScript } from '@/lib/theme';
import { touchInitScript } from '@/lib/touch';

// Permite pinch-to-zoom en móvil (Next.js no restringe el zoom por defecto,
// pero lo hacemos explícito para que ningún cambio futuro lo bloquee sin querer).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: touchInitScript }} />
      </head>
      <body className="min-h-screen bg-surface-secondary text-text antialiased font-sans m-0 p-0 overflow-hidden">
        <ThemeProvider>
          <LocaleProvider>
            <LocaleLang />
            <main className="h-screen w-screen overflow-hidden">{children}</main>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
