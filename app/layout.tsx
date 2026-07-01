import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { AuthProvider }   from '@/components/auth/AuthProvider';
import { PullToRefresh }  from '@/components/ui/PullToRefresh';
import { ScrollToTop }    from '@/components/ui/ScrollToTop';
import { Toaster }        from '@/components/ui/Toast';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1700a5',
};

export const metadata: Metadata = {
  title: 'Negozio',
  description: 'Sistema de gestión de tienda',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Negozio',
  },
  icons: {
    icon:     '/logos/negozio-icon.png',
    apple:    '/logos/negozio-icon.png',
    shortcut: '/logos/negozio-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ScrollToTop />
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
        <PullToRefresh />
      </body>
    </html>
  );
}
