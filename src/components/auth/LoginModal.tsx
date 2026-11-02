import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { syncManager } from '@/lib/sync';
import {
  RiArrowRightLine,
  RiCheckLine,
  RiCloseLine,
  RiEyeLine,
  RiEyeOffLine,
  RiInformationLine,
  RiLogoutBoxRLine,
  RiMailCheckLine,
  RiMailLine,
} from '@remixicon/react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputClass =
  'h-12 w-full rounded-xl border border-border/70 bg-background/60 px-3.5 text-[13px] text-foreground placeholder:text-subtle transition-colors focus:border-foreground/25 focus:outline-none focus:ring-2 focus:ring-foreground/10 disabled:opacity-60';

const primaryClass =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-[13px] font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70';

const GoogleMark = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    className="size-[18px] shrink-0"
    aria-hidden="true"
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    signInWithPassword,
    signUpWithPassword,
    resetPasswordForEmail,
    signInWithOtp,
    verifyOtp,
    signInWithGoogle,
    signOut,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [viewMode, setViewMode] = useState<'main' | 'forgot_password' | 'magic_link' | 'otp'>('main');
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If user just got signed in, auto sync and close.
  useEffect(() => {
    if (user && isOpen && viewMode !== 'main') {
      syncManager.performSync();
      onClose();
    }
  }, [user, isOpen, viewMode, onClose]);

  if (!isOpen) return null;

  // Unified smart sign-in / sign-up: try login, then create the account.
  const handleSmartContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('لطفاً یک ایمیل معتبر وارد کنید.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const { error: signInErr } = await signInWithPassword(trimmedEmail, password);
      if (!signInErr) {
        setSuccessMessage('با موفقیت وارد شدید!');
        syncManager.performSync();
        setTimeout(() => {
          onClose();
          setPassword('');
        }, 700);
        return;
      }

      const signInMsg = (signInErr.message || '').toLowerCase();
      const isInvalidCredentials =
        signInMsg.includes('invalid login credentials') ||
        signInMsg.includes('invalid credentials');

      if (isInvalidCredentials) {
        const { error: signUpErr } = await signUpWithPassword(trimmedEmail, password);
        if (!signUpErr) {
          setSuccessMessage('حساب کاربری شما با موفقیت ایجاد شد و وارد شدید!');
          syncManager.performSync();
          setTimeout(() => {
            onClose();
            setPassword('');
          }, 800);
          return;
        }

        const signUpMsg = (signUpErr.message || '').toLowerCase();
        if (
          signUpMsg.includes('already registered') ||
          signUpMsg.includes('user already exists')
        ) {
          setErrorMessage(
            'این ایمیل قبلاً ثبت شده است، اما رمز عبور وارد شده اشتباه است. لطفاً رمز صحیح را وارد کنید یا گزینه فراموشی رمز را بزنید.'
          );
          return;
        }

        setErrorMessage(signUpErr.message || 'خطا در ثبت‌نام حساب جدید');
        return;
      }

      if (signInMsg.includes('email not confirmed')) {
        setErrorMessage(
          'ایمیل شما تایید نشده است. لطفاً در پنل Supabase بخش Providers > Email گزینه Confirm email را غیرفعال کنید یا ایمیل خود را تایید نمایید.'
        );
        return;
      }

      setErrorMessage(signInErr.message || 'خطا در ورود به حساب');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'خطایی در ارتباط با سرور رخ داد');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('لطفاً ایمیل خود را برای بازیابی رمز وارد کنید.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const { error } = await resetPasswordForEmail(trimmedEmail);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccessMessage(
          'لینک بازیابی رمز عبور به ایمیل شما فرستاده شد. لطفاً صندوق ورودی یا اسپم را بررسی کنید.'
        );
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'خطا در ارسال ایمیل بازیابی');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('لطفاً یک ایمیل معتبر وارد کنید.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const { error } = await signInWithOtp(trimmedEmail);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setViewMode('otp');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'خطایی در ارتباط با سرور رخ داد');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken || otpToken.trim().length < 6) {
      setErrorMessage('لطفاً کد ۶ رقمی را وارد کنید.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const { error } = await verifyOtp(email.trim(), otpToken.trim());
      if (error) {
        setErrorMessage(error.message || 'کد وارد شده نامعتبر است.');
      } else {
        setSuccessMessage('با موفقیت وارد شدید!');
        syncManager.performSync();
        setTimeout(() => {
          onClose();
          setViewMode('main');
          setOtpToken('');
        }, 800);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'خطا در تایید کد');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        const errStr = (error.message || '').toLowerCase();
        if (
          errStr.includes('provider is not enabled') ||
          errStr.includes('validation_failed') ||
          errStr.includes('unsupported provider')
        ) {
          setErrorMessage(
            'ورود با گوگل هنوز در پنل سوپابیس فعال نشده است. لطفاً از طریق ایمیل و پسورد وارد شوید یا در پنل Supabase گزینه Google را فعال کنید.'
          );
        } else {
          setErrorMessage(error.message);
        }
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'خطا در ورود با گوگل');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
    setLoading(false);
    setViewMode('main');
  };

  const resetToMain = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setViewMode('main');
  };

  return (
    <div
      className="fixed inset-0 z-20 overflow-y-auto bg-background font-sans text-foreground"
      dir="rtl"
    >
      <button
        type="button"
        onClick={onClose}
        className="fixed left-5 top-14 z-10 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        title="بازگشت به برنامه"
        aria-label="بازگشت به برنامه"
      >
        <RiCloseLine className="size-4" />
      </button>

      <div className="flex min-h-full items-center justify-center px-5 py-12">
        <div className="w-full max-w-[420px]">
          <div className="flex flex-col items-center text-center">
            <img
              src="/Boxs/Box 2.png"
              alt=""
              className="size-14 rounded-2xl object-contain"
            />
            <h1 className="mt-4 font-darvish text-[34px] font-semibold leading-tight tracking-tight text-foreground">
              جعبه
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
              ذهن دوم تو، برای کارهای بزرگ.
            </p>
          </div>

          {user ? (
            <div className="mt-8 rounded-[24px] border border-border/70 bg-card p-6 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <RiCheckLine className="size-6" />
              </div>
              <h2 className="mt-4 text-[16px] font-semibold text-foreground">وارد شدی</h2>
              <p
                dir="ltr"
                className="mt-1 truncate font-mono text-[11.5px] text-muted-foreground"
              >
                {user.email}
              </p>
              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    syncManager.performSync();
                    onClose();
                  }}
                  className={primaryClass}
                >
                  همگام‌سازی و بازگشت به برنامه
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 text-[12.5px] font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-60"
                >
                  <RiLogoutBoxRLine className="size-4" />
                  <span>خروج از حساب</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-8 rounded-[24px] border border-border/70 bg-card p-5 sm:p-6">
                {errorMessage && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-[11.5px] leading-6 text-destructive">
                    <RiInformationLine className="mt-0.5 size-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-[11.5px] leading-6 text-emerald-600 dark:text-emerald-400">
                    {successMessage}
                  </div>
                )}

                {viewMode === 'main' && (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-border/70 bg-secondary/40 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>ادامه با گوگل</span>
                      <GoogleMark />
                    </button>

                    <div className="my-4 flex items-center gap-3">
                      <span className="h-px flex-1 bg-border/60" />
                      <span className="text-[10px] text-subtle">یا</span>
                      <span className="h-px flex-1 bg-border/60" />
                    </div>

                    <form onSubmit={handleSmartContinue} className="space-y-3">
                      <div>
                        <label htmlFor="auth-email-input" className="sr-only">
                          ایمیل
                        </label>
                        <input
                          id="auth-email-input"
                          type="email"
                          required
                          disabled={loading}
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="ایمیل"
                          dir="ltr"
                          className={`${inputClass} text-left`}
                        />
                      </div>

                      <div className="relative">
                        <label htmlFor="auth-pwd-input" className="sr-only">
                          رمز عبور
                        </label>
                        <input
                          id="auth-pwd-input"
                          type={showPassword ? 'text' : 'password'}
                          required
                          disabled={loading}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="رمز عبور"
                          dir="ltr"
                          className={`${inputClass} pl-10 text-left`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((visible) => !visible)}
                          className="absolute left-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          title={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                          aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                        >
                          {showPassword ? (
                            <RiEyeOffLine className="size-4" />
                          ) : (
                            <RiEyeLine className="size-4" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3 pb-0.5">
                        <span className="text-[10.5px] text-subtle">ورود یا ساخت حساب</span>
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMessage(null);
                            setSuccessMessage(null);
                            setViewMode('forgot_password');
                          }}
                          className="rounded-sm text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                          فراموشی رمز عبور؟
                        </button>
                      </div>

                      <button type="submit" disabled={loading} className={primaryClass}>
                        {loading ? (
                          <>
                            <span className="size-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                            <span>در حال ورود یا ثبت‌نام...</span>
                          </>
                        ) : (
                          'ادامه با ایمیل'
                        )}
                      </button>

                      <p className="text-center text-[10.5px] leading-5 text-subtle">
                        اگر حساب نداری، با همین ایمیل ساخته می‌شود.
                      </p>
                    </form>
                  </>
                )}

                {viewMode === 'forgot_password' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetToMain}
                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        aria-label="بازگشت به ورود"
                      >
                        <RiArrowRightLine className="size-4" />
                      </button>
                      <h2 className="text-[15px] font-semibold text-foreground">
                        بازیابی رمز عبور
                      </h2>
                    </div>
                    <p className="text-[11.5px] leading-6 text-muted-foreground">
                      ایمیل حسابت را وارد کن تا لینک تغییر رمز برایت بفرستیم.
                    </p>
                    <form onSubmit={handleForgotPassword} className="space-y-3">
                      <label htmlFor="auth-forgot-email" className="sr-only">
                        ایمیل
                      </label>
                      <input
                        id="auth-forgot-email"
                        type="email"
                        required
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ایمیل"
                        dir="ltr"
                        className={`${inputClass} text-left`}
                      />
                      <button type="submit" disabled={loading} className={primaryClass}>
                        {loading ? 'در حال ارسال...' : 'ارسال لینک تغییر رمز'}
                      </button>
                    </form>
                  </div>
                )}

                {viewMode === 'magic_link' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetToMain}
                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        aria-label="بازگشت به ورود"
                      >
                        <RiArrowRightLine className="size-4" />
                      </button>
                      <h2 className="text-[15px] font-semibold text-foreground">ورود بدون رمز</h2>
                    </div>
                    <p className="text-[11.5px] leading-6 text-muted-foreground">
                      یک لینک یک‌بار مصرف به ایمیلت می‌فرستیم؛ با کلیک روی آن وارد می‌شوی.
                    </p>
                    <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
                      <label htmlFor="auth-magic-email" className="sr-only">
                        ایمیل
                      </label>
                      <input
                        id="auth-magic-email"
                        type="email"
                        required
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ایمیل"
                        dir="ltr"
                        className={`${inputClass} text-left`}
                      />
                      <button type="submit" disabled={loading} className={primaryClass}>
                        {loading ? 'در حال ارسال لینک...' : 'ارسال لینک ورود'}
                      </button>
                    </form>
                  </div>
                )}

                {viewMode === 'otp' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetToMain}
                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        aria-label="بازگشت به ورود"
                      >
                        <RiArrowRightLine className="size-4" />
                      </button>
                      <h2 className="text-[15px] font-semibold text-foreground">
                        کد ورود را وارد کن
                      </h2>
                    </div>

                    <div className="flex items-start gap-2.5 rounded-xl bg-secondary/40 p-3 text-[11.5px] leading-6 text-muted-foreground">
                      <RiMailCheckLine className="mt-0.5 size-4 shrink-0" />
                      <span>
                        کد ۶ رقمی به <span dir="ltr" className="font-mono">{email}</span> فرستادیم.
                      </span>
                    </div>

                    <form onSubmit={handleVerifyOtp} className="space-y-3">
                      <label htmlFor="auth-otp-input" className="sr-only">
                        کد تایید
                      </label>
                      <input
                        id="auth-otp-input"
                        type="text"
                        inputMode="numeric"
                        required
                        maxLength={6}
                        value={otpToken}
                        onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                        placeholder="• • • • • •"
                        dir="ltr"
                        autoFocus
                        className={`${inputClass} text-center text-lg tracking-[0.4em]`}
                      />
                      <button type="submit" disabled={loading} className={primaryClass}>
                        {loading ? 'در حال بررسی...' : 'تایید کد و ورود'}
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={resetToMain}
                      className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      بازگشت به ورود با رمز
                    </button>
                  </div>
                )}
              </div>

              {viewMode === 'main' && (
                <div className="mt-5 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setViewMode('magic_link');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RiMailLine className="size-3.5" />
                    <span>ورود بدون رمز با لینک ایمیل</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border/70 text-[12.5px] font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    ادامه بدون حساب
                    <span className="text-[10.5px] font-normal text-subtle">استفادهٔ آفلاین</span>
                  </button>
                </div>
              )}
            </>
          )}

          <p className="mt-8 text-center text-[10.5px] leading-5 text-subtle">
            جعبه آفلاین کار می‌کند؛ ورود فقط برای همگام‌سازی است.
          </p>
        </div>
      </div>
    </div>
  );
};
