import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { syncManager } from '@/lib/sync';
import {
  RiCloseLine,
  RiCheckLine,
  RiArrowRightLine,
  RiMailLine,
  RiMailCheckLine,
  RiLogoutBoxRLine,
  RiInformationLine,
  RiEyeLine,
  RiEyeOffLine,
  RiKeyLine,
} from '@remixicon/react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

  // If user just got signed in, auto sync and close
  useEffect(() => {
    if (user && isOpen && viewMode !== 'main') {
      syncManager.performSync();
      onClose();
    }
  }, [user, isOpen, viewMode, onClose]);

  if (!isOpen) return null;

  // Unified Smart Login / Registration
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
      // 1. Attempt Sign In
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

      // 2. If credentials not found, attempt seamless Sign Up
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
        // If user already exists in DB, it means their password was incorrect!
        if (
          signUpMsg.includes('already registered') ||
          signUpMsg.includes('user already exists')
        ) {
          setErrorMessage('این ایمیل قبلاً ثبت شده است، اما رمز عبور وارد شده اشتباه است. لطفاً رمز صحیح را وارد کنید یا گزینه فراموشی رمز را بزنید.');
          return;
        }

        setErrorMessage(signUpErr.message || 'خطا در ثبت‌نام حساب جدید');
        return;
      }

      if (signInMsg.includes('email not confirmed')) {
        setErrorMessage('ایمیل شما تایید نشده است. لطفاً در پنل Supabase بخش Providers > Email گزینه Confirm email را غیرفعال کنید یا ایمیل خود را تایید نمایید.');
        return;
      }

      setErrorMessage(signInErr.message || 'خطا در ورود به حساب');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'خطایی در ارتباط با سرور رخ داد');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password submit
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('لطفاً ایمیل خود را برای بازیابی رمز وارد کنید.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      const { error } = await resetPasswordForEmail(trimmedEmail);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccessMessage('لینک بازیابی رمز عبور به ایمیل شما فرستاده شد. لطفاً صندوق ورودی یا اسپم را بررسی کنید.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'خطا در ارسال ایمیل بازیابی');
    } finally {
      setLoading(false);
    }
  };

  // Magic Link submit
  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('لطفاً یک ایمیل معتبر وارد کنید.');
      return;
    }

    setErrorMessage(null);
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

  // OTP Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken || otpToken.trim().length < 6) {
      setErrorMessage('لطفاً کد ۶ رقمی را وارد کنید.');
      return;
    }

    setErrorMessage(null);
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
  };

  return (
    <div
      className="absolute inset-0 z-40 w-full h-full bg-card text-card-foreground flex flex-col overflow-y-auto no-scrollbar animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="relative w-full flex flex-col min-h-full">
        {/* Floating Back / Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 left-3 z-30 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition cursor-pointer backdrop-blur-md shadow-md active:scale-95"
          title="بازگشت به برنامه"
        >
          <RiCloseLine className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* If user is already logged in */}
        {user ? (
          <div className="p-6 text-center space-y-5 my-auto max-w-md mx-auto w-full">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30 shadow-xs">
              <RiCheckLine className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-foreground">شما وارد شده‌اید</h2>
              <p className="text-sm text-muted-foreground mt-1 dir-ltr font-mono">{user.email}</p>
              <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                متصل به پایگاه ابری Supabase
              </div>
            </div>

            <div className="pt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  syncManager.performSync();
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-xl bg-foreground text-background font-bold text-sm transition cursor-pointer shadow-sm hover:opacity-90 active:scale-[0.99]"
              >
                همگام‌سازی و بازگشت به برنامه
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-semibold transition-colors cursor-pointer border border-destructive/20"
              >
                <RiLogoutBoxRLine className="w-4 h-4" />
                <span>خروج از حساب کاربری</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col w-full flex-1">
            {/* Top Illustration Banner */}
            <div className="w-full bg-zinc-900 border-b border-border/40 shrink-0 overflow-hidden">
              <img
                src="/login-banner.png"
                alt="MiniPini Space Office"
                className="w-full h-auto object-cover select-none pointer-events-none block max-h-56"
              />
            </div>

            {/* Dotted Line Divider */}
            <div className="px-5 pt-3 pb-1">
              <div
                className="w-full h-3 select-none pointer-events-none opacity-50"
                style={{
                  backgroundImage: 'radial-gradient(circle, #71717a 1.25px, transparent 1.25px)',
                  backgroundSize: '6.5px 6px',
                }}
              />
            </div>

            {/* Content Area */}
            <div className="px-5 pb-8 pt-1 flex-1 flex flex-col justify-between text-right space-y-4 max-w-md mx-auto w-full">
              <div className="space-y-3.5">
                {/* Heading & Subtitle */}
                <div>
                  <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-1">
                    <span>#مینی‌پینی!</span>
                  </h1>
                  <p className="text-xs text-muted-foreground font-normal mt-1">
                    یادداشت‌ها، کارها و عادت‌ها در یک فضا!
                  </p>
                </div>

                {/* Status / Error Alerts */}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed text-right flex items-start gap-2 animate-in fade-in">
                    <RiInformationLine className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs leading-relaxed text-right animate-in fade-in">
                    {successMessage}
                  </div>
                )}

                {/* VIEW 1: UNIFIED EMAIL + PASSWORD FORM */}
                {viewMode === 'main' && (
                  <form onSubmit={handleSmartContinue} className="space-y-3 pt-1">
                    {/* Email Input */}
                    <div className="space-y-1.5 text-right">
                      <label htmlFor="auth-email-input" className="block text-xs font-semibold text-foreground/90">
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
                        placeholder="name@example.com"
                        className="w-full h-11 px-3.5 rounded-xl bg-background border border-border text-foreground text-sm text-right placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground transition disabled:opacity-60"
                      />
                    </div>

                    {/* Password Input with show/hide toggle */}
                    <div className="space-y-1.5 text-right">
                      <div className="flex items-center justify-between">
                        <label htmlFor="auth-pwd-input" className="block text-xs font-semibold text-foreground/90">
                          رمز عبور
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMessage(null);
                            setSuccessMessage(null);
                            setViewMode('forgot_password');
                          }}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          فراموشی رمز عبور؟
                        </button>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          id="auth-pwd-input"
                          type={showPassword ? 'text' : 'password'}
                          required
                          disabled={loading}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="حداقل ۶ کاراکتر"
                          className="w-full h-11 pr-3.5 pl-10 rounded-xl bg-background border border-border text-foreground text-sm text-right placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground transition disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                        >
                          {showPassword ? <RiEyeOffLine className="w-4 h-4" /> : <RiEyeLine className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Primary Button: ادامه */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 mt-2 rounded-xl bg-[#18181b] hover:bg-black text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-75 disabled:cursor-wait"
                    >
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900 rounded-full animate-spin" />
                          <span className="text-xs">در حال ورود یا ثبت‌نام...</span>
                        </>
                      ) : (
                        'ادامه'
                      )}
                    </button>

                    {/* Subtle Divider Line */}
                    <div className="w-full border-t border-border/70 my-2" />

                    {/* Google OAuth Button: ورود با گوگل */}
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full h-11 rounded-xl bg-card hover:bg-secondary/70 border border-border text-foreground text-sm font-semibold flex items-center justify-center gap-2.5 transition cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-50"
                    >
                      <span>ورود با گوگل</span>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        className="w-5 h-5 shrink-0"
                        style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', maxWidth: '20px', maxHeight: '20px' }}
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
                    </button>

                    {/* Secondary Link: ورود با لینک جادویی */}
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMessage(null);
                          setSuccessMessage(null);
                          setViewMode('magic_link');
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RiMailLine className="w-3.5 h-3.5" />
                        <span>ورود بدون رمز (لینک یک‌بار مصرف ایمیل)</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* VIEW 2: FORGOT PASSWORD */}
                {viewMode === 'forgot_password' && (
                  <form onSubmit={handleForgotPassword} className="space-y-3.5 pt-1 animate-in fade-in duration-200">
                    <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/80 text-right space-y-1.5">
                      <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                        <RiKeyLine className="w-4 h-4 text-primary" />
                        <span>بازیابی رمز عبور</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        ایمیل خود را وارد کنید تا لینک تغییر رمز برای شما ارسال شود.
                      </p>
                    </div>

                    <div className="space-y-1.5 text-right">
                      <label htmlFor="auth-forgot-email" className="block text-xs font-semibold text-foreground/90">
                        ایمیل حساب کاربری
                      </label>
                      <input
                        id="auth-forgot-email"
                        type="email"
                        required
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full h-11 px-3.5 rounded-xl bg-background border border-border text-foreground text-sm text-right placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground transition disabled:opacity-60"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 rounded-xl bg-[#18181b] hover:bg-black text-white dark:bg-white dark:text-zinc-900 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? 'در حال ارسال ایمیل بازیابی...' : 'ارسال لینک تغییر رمز'}
                    </button>

                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMessage(null);
                          setSuccessMessage(null);
                          setViewMode('main');
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RiArrowRightLine className="w-3.5 h-3.5" />
                        <span>بازگشت به صفحه ورود</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* VIEW 3: MAGIC LINK */}
                {viewMode === 'magic_link' && (
                  <form onSubmit={handleMagicLinkSubmit} className="space-y-3.5 pt-1 animate-in fade-in duration-200">
                    <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/80 text-right space-y-1.5">
                      <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                        <RiMailLine className="w-4 h-4 text-primary" />
                        <span>ورود بدون رمز با لینک جادویی</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        لینکی به ایمیل شما ارسال می‌شود که با کلیک روی آن مستقیماً وارد برنامه می‌شوید.
                      </p>
                    </div>

                    <div className="space-y-1.5 text-right">
                      <label htmlFor="auth-magic-email" className="block text-xs font-semibold text-foreground/90">
                        ایمیل
                      </label>
                      <input
                        id="auth-magic-email"
                        type="email"
                        required
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full h-11 px-3.5 rounded-xl bg-background border border-border text-foreground text-sm text-right placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground transition disabled:opacity-60"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 rounded-xl bg-[#18181b] hover:bg-black text-white dark:bg-white dark:text-zinc-900 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? 'در حال ارسال لینک...' : 'ارسال لینک ورود'}
                    </button>

                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMessage(null);
                          setSuccessMessage(null);
                          setViewMode('main');
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RiArrowRightLine className="w-3.5 h-3.5" />
                        <span>بازگشت به ورود با رمز عبور</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* VIEW 4: OTP CONFIRMATION */}
                {viewMode === 'otp' && (
                  <div className="space-y-4 pt-1 text-right animate-in fade-in duration-200">
                    <div className="p-4 rounded-2xl bg-secondary/40 border border-border/80 text-center space-y-2.5">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center border border-primary/20">
                        <RiMailCheckLine className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-foreground">لینک ورود ارسال شد!</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        یک ایمیل حاوی لینک و کد تایید به آدرس زیر فرستاده شد:
                      </p>
                      <div className="py-1 px-3 rounded-lg bg-background border border-border/60 font-mono text-xs text-foreground dir-ltr font-semibold inline-block">
                        {email}
                      </div>
                    </div>

                    <form onSubmit={handleVerifyOtp} className="space-y-2.5 pt-1">
                      <label htmlFor="auth-otp-input" className="block text-xs font-semibold text-foreground/90">
                        یا کد تایید ۶ رقمی را وارد کنید:
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
                        className="w-full h-11 px-4 rounded-xl bg-background border border-border text-foreground text-center font-mono tracking-widest text-lg placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground transition"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-10 rounded-xl bg-[#18181b] hover:bg-black text-white dark:bg-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {loading ? 'در حال بررسی...' : 'تایید کد و ورود'}
                      </button>
                    </form>

                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode('main');
                          setOtpToken('');
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RiArrowRightLine className="w-3.5 h-3.5" />
                        <span>بازگشت به ورود با رمز</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
