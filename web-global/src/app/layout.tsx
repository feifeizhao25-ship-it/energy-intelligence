import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'EnergyIQ — Renewable Energy Intelligence',
    template: '%s | EnergyIQ',
  },
  description:
    'AI-powered feasibility, finance and market intelligence for solar, wind and storage projects.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A2E6B',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
