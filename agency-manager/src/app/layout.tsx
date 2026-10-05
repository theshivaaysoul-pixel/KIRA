import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { GradientGridBackground } from '@/components/ui/GradientGridBackground';

export const metadata: Metadata = {
  title: 'KIRA Agency Manager',
  description: 'The central management platform for KIRA Agency — accounts, content, calendar, analytics, and team management.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#7c3aed" />
        <link rel="icon" href="/logo.png" type="image/png" />
      </head>
      <body>
        <Providers>
          <GradientGridBackground />
          {children}
        </Providers>
      </body>
    </html>
  );
}
