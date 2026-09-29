import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { DemoBanner } from '@/components/layout/demo-banner';
import { CompareTray } from '@/components/layout/compare-tray';
import { HydrationMarker } from '@/components/layout/hydration-marker';
import { SITE, titleSuffix } from '@/lib/site';
import { getSiteUrl, isDemoMode } from '@/server/env';

export async function generateMetadata(): Promise<Metadata> {
  const demo = isDemoMode();
  const suffix = titleSuffix(demo);
  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: `${SITE.name}${demo ? '（デモ）' : ''}｜${SITE.tagline}`,
      template: `%s${suffix}`,
    },
    description: SITE.description,
    applicationName: SITE.name,
    openGraph: { siteName: SITE.name, locale: 'ja_JP', type: 'website' },
    // デモ・ステージングはnoindex（本番の個別判定は各ページで行う）
    robots: demo ? { index: false, follow: false } : undefined,
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const demo = isDemoMode();
  return (
    <html lang="ja">
      <body className="min-h-dvh">
        <ToastProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-3 focus:font-bold"
          >
            本文へスキップ
          </a>
          {demo ? <DemoBanner /> : null}
          <SiteHeader demo={demo} />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <SiteFooter />
          <CompareTray />
          <HydrationMarker />
        </ToastProvider>
      </body>
    </html>
  );
}
