import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { AuthProvider } from '@/components/auth/AuthProvider';
import { Toaster }      from '@/components/ui/Toast';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Negozio',
  description: 'Sistema de gestión de tienda',
  icons: {
    icon:     '/logos/negozio-icon-principal.png',
    apple:    '/logos/negozio-icon-principal.png',
    shortcut: '/logos/negozio-icon-principal.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
