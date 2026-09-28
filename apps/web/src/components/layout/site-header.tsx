'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Menu } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSavedIds } from '@/lib/local-lists';
import { cn } from '@/lib/utils';

const primaryNav = [
  { href: '/jobs', label: '求人を探す', match: (p: string) => p === '/jobs' || p.startsWith('/jobs/') },
  { href: '/#occupations', label: '職種から探す', match: (p: string) => p.startsWith('/occupations') },
];

function SavedCount() {
  const count = useSavedIds().length;
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary-soft px-1.5 text-xs font-bold text-primary-ink" data-testid="saved-count">
      {count}
      <span className="sr-only">件</span>
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const isAdmin = pathname.startsWith('/admin');
  return (
    <header className="border-b border-line bg-surface">
      <div className="page-container flex h-16 items-center gap-4 lg:h-[72px] lg:gap-8">
        <Link href="/" className="flex min-h-11 shrink-0 items-baseline gap-2 text-ink no-underline" aria-label="WORKLENS（開発仮称）ホーム">
          <span className="text-xl font-black tracking-[0.06em] lg:text-[23px]">WORKLENS</span>
          <span className="hidden text-[11px] font-bold text-muted sm:inline">開発仮称</span>
        </Link>

        <nav aria-label="主なメニュー" className="hidden flex-1 justify-center lg:flex">
          <ul className="flex items-center gap-2">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={item.match(pathname) ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-lg px-3 text-[15px] font-bold no-underline hover:bg-page',
                    item.match(pathname) ? 'text-primary' : 'text-ink',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0 lg:gap-2">
          <Link
            href="/saved"
            aria-current={pathname === '/saved' ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold no-underline hover:bg-page',
              pathname === '/saved' ? 'text-primary' : 'text-ink',
            )}
          >
            <Bookmark aria-hidden className="size-5" />
            <span>保存</span>
            <SavedCount />
          </Link>
          <Link
            href={isAdmin ? '/admin/sources' : '/employers'}
            className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-bold text-ink no-underline hover:bg-page lg:inline-flex"
          >
            {isAdmin ? '管理画面デモ' : '採用ご担当者へ'}
          </Link>
          <MobileMenu pathname={pathname} />
        </div>
      </div>
    </header>
  );
}

function MobileMenu({ pathname }: { pathname: string }) {
  const links = [
    { href: '/jobs', label: '求人を探す' },
    { href: '/#occupations', label: '職種から探す' },
    { href: '/saved', label: '保存した求人' },
    { href: '/compare', label: '比較' },
    { href: '/employers', label: '採用ご担当者へ' },
    { href: '/report', label: '掲載情報の訂正・削除' },
    { href: '/sources', label: '収集方針' },
    { href: '/about', label: '運営者情報' },
  ];
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-page lg:hidden" aria-label="メニューを開く">
        <Menu aria-hidden className="size-6" />
      </DialogTrigger>
      <DialogContent side="right" aria-describedby={undefined}>
        <div className="border-b border-line px-5 py-4 pr-16">
          <DialogTitle className="text-lg font-bold">メニュー</DialogTitle>
        </div>
        <nav aria-label="メニュー" className="overflow-y-auto px-3 py-3">
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center rounded-lg px-3 text-base font-bold text-ink no-underline hover:bg-page"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </DialogContent>
    </Dialog>
  );
}
