import React, { useState } from 'react';
import { RiDeleteBinLine, RiLock2Line, RiLoginBoxLine } from '@remixicon/react';
import { clearLocalUserData } from '@/lib/localData';

interface AuthWallProps {
  onSignIn: () => void;
}

/**
 * Shown instead of the app when nobody is signed in.
 *
 * The database is local, so signing out does not remove it by itself — without
 * this wall the previous account's tasks and notes stay on screen for anyone
 * who opens the app afterwards.
 */
export const AuthWall: React.FC<AuthWallProps> = ({ onSignIn }) => {
  const [wiping, setWiping] = useState(false);

  const handleWipe = async () => {
    setWiping(true);
    try {
      await clearLocalUserData();
    } catch (err) {
      console.warn('Failed to clear the device data:', err);
    }
    window.location.reload();
  };

  return (
    <div
      dir="rtl"
      className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-5 py-16"
    >
      <div className="w-full max-w-[380px] text-center">
        <img
          src="/Boxs/Box 2.png"
          alt=""
          className="mx-auto size-14 rounded-2xl object-contain"
        />

        <h1 className="mt-4 font-darvish text-[26px] font-semibold leading-9 text-foreground">
          جعبه قفل است
        </h1>
        <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">
          کارها و یادداشت‌های این دستگاه به یک حساب تعلق دارند. برای دیدنشان
          وارد همان حساب شو.
        </p>

        <button
          type="button"
          onClick={onSignIn}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-[13px] font-semibold text-background transition-opacity hover:opacity-90"
        >
          <RiLoginBoxLine className="size-4" />
          <span>ورود به حساب</span>
        </button>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/60 bg-secondary/30 p-3 text-right text-[11px] leading-6 text-muted-foreground">
          <RiLock2Line className="mt-0.5 size-3.5 shrink-0" />
          <span>
            هیچ داده‌ای بدون ورود نمایش داده نمی‌شود؛ چک کردن حساب و مالکیت داده
            روی همین دستگاه انجام می‌شود.
          </span>
        </div>

        <button
          type="button"
          onClick={handleWipe}
          disabled={wiping}
          className="mt-6 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-subtle transition-colors hover:text-destructive disabled:opacity-60"
        >
          <RiDeleteBinLine className="size-3.5" />
          <span>{wiping ? 'در حال پاک کردن...' : 'پاک کردن داده‌های این دستگاه'}</span>
        </button>
      </div>
    </div>
  );
};
