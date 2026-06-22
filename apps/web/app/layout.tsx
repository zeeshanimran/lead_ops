import type { Metadata } from 'next';
import Script from 'next/script';
import { Toaster } from '@/components/toaster';
import './globals.css';

export const metadata: Metadata = {
  title: 'LeadOps CRM',
  description: 'CodeBricks lead operations CRM',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Script src="/runtime-config.js" strategy="beforeInteractive" />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
