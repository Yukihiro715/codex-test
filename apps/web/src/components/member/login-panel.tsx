'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Bookmark, History, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { demoLogin, logout, useMember } from '@/components/member/member-provider';
import { MEMBER_PROVIDERS, memberProviderName, type MemberProviderId, type MemberSummary } from '@/lib/member';
import { initMemberPrefs } from '@/lib/member-lists';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BENEFITS = [
  { icon: Bookmark, text: '保存した求人を、スマホとパソコンで共有' },
  { icon: Bell, text: '検索条件を保存して、新着求人をメールで受け取る' },
  { icon: History, text: '最近見た求人を、あとから見返す' },
];

/**
 * ログイン・会員登録（デモ）。登録済みならログイン、未登録ならそのまま登録に進む1画面の方式。
 * デモでは外部サービスに接続せず、どのボタンでも架空の会員としてログインする。
 * 本実装では各社の公式ボタン素材（ガイドラインに沿ったロゴ・文言）に置き換える。
 */
export function LoginPanel({ next, member }: { next: string; member: MemberSummary | null }) {
  const [remember, setRemember] = useState(true);
  const [mailOptIn, setMailOptIn] = useState(true);
  const [pending, setPending] = useState<MemberProviderId | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { refresh } = useMember();

  const login = async (provider: MemberProviderId) => {
    setPending(provider);
    setError(null);
    const result = await demoLogin(provider, remember);
    if (result.ok) {
      initMemberPrefs({ mailOptIn });
      await refresh();
      router.push(next);
      return;
    }
    setPending(null);
    setError(result.message);
  };

  const onEmailSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError('メールアドレスを正しく入力してください');
      document.getElementById('login-email')?.focus();
      return;
    }
    setEmailError(null);
    void login('email');
  };

  if (member) {
    return (
      <div className="mt-6 rounded-xl bg-page p-5" data-testid="login-already">
        <p className="font-bold">
          {member.displayName}として{memberProviderName(member.provider)}でログイン中です。
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={next}>{next === '/mypage' ? 'マイページへ' : '元のページへ戻る'}</Link>
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              await logout();
              await refresh();
              router.refresh();
            }}
          >
            ログアウト
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-5 space-y-2" aria-label="会員登録でできること">
        {BENEFITS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2 text-[15px]">
            <Icon aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
            {text}
          </li>
        ))}
      </ul>

      <p className="mt-5 rounded-xl bg-page p-3 text-xs leading-relaxed text-muted" data-testid="login-demo-note">
        デモ：外部のサービスには接続しません。どのボタンを押しても、架空の会員としてログインします。ボタンのロゴは、本番で各サービスの公式デザインに置き換えます。
      </p>

      <div className="mt-5 space-y-3" aria-busy={pending !== null}>
        {MEMBER_PROVIDERS.map((provider) => {
          const isEmail = provider.id === 'email';
          return (
            <Button
              key={provider.id}
              variant="secondary"
              size="lg"
              className="relative min-h-14 w-full rounded-xl text-base"
              disabled={pending !== null}
              aria-expanded={isEmail ? emailOpen : undefined}
              aria-controls={isEmail ? 'login-email-form' : undefined}
              onClick={() => (isEmail ? setEmailOpen((open) => !open) : void login(provider.id))}
            >
              {isEmail ? <Mail aria-hidden className="absolute left-5 size-5" /> : null}
              {pending === provider.id ? 'ログインしています…' : provider.action}
            </Button>
          );
        })}
      </div>

      {emailOpen ? (
        <form id="login-email-form" className="mt-4 rounded-xl border border-line p-4" onSubmit={onEmailSubmit} noValidate>
          <label htmlFor="login-email" className="block text-sm font-bold">
            メールアドレス
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className="field-input mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? 'login-email-hint login-email-error' : 'login-email-hint'}
          />
          <p id="login-email-hint" className="mt-1 text-xs text-muted">
            ログイン用のリンクをメールでお送りします（デモでは送信せず、入力したアドレスも保存しません）。
          </p>
          {emailError ? (
            <p id="login-email-error" className="mt-1 text-sm font-bold text-danger">
              {emailError}
            </p>
          ) : null}
          <Button type="submit" className="mt-3 w-full" disabled={pending !== null}>
            ログイン用のリンクを送る
          </Button>
        </form>
      ) : null}

      <div className="mt-6 space-y-1">
        <label className="check-row font-bold">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} aria-describedby="login-remember-hint" />
          <span>ログイン状態を保持する</span>
        </label>
        <p id="login-remember-hint" className="pl-[30px] text-xs text-muted">
          共用のパソコンではオフにしてください。
        </p>
        <label className="check-row font-bold">
          <input type="checkbox" checked={mailOptIn} onChange={(e) => setMailOptIn(e.target.checked)} aria-describedby="login-mail-hint" />
          <span>新着求人・おすすめ求人のメールを受け取る</span>
        </label>
        <p id="login-mail-hint" className="pl-[30px] text-xs text-muted">
          マイページからいつでも停止できます。
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger-soft p-3 text-sm font-bold text-danger">
          {error}
        </p>
      ) : null}

      <p className="mt-5">
        <Link href="/login/help" className="inline-flex min-h-11 items-center font-bold">
          ログインでお困りの方
        </Link>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted" data-testid="login-consent">
        ログイン・会員登録をすると、<Link href="/terms">利用規約</Link>と<Link href="/privacy">求人マップにおける情報の取扱い</Link>
        に同意したものとします。
      </p>
    </>
  );
}
