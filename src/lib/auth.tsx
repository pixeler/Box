import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabase } from './cloud';
import { IS_CLOUD_BUILD, claimLocalDataForUser, clearLocalUserData } from './localData';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True once the stored session has been read: the UI can trust `user`. */
  ready: boolean;
  signInWithOtp: (email: string) => Promise<{ error: AuthError | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: AuthError | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
}

/** Restoring a session must never block the app forever if the backend is down. */
const SESSION_RESTORE_TIMEOUT_MS = 6000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // Starts `false`: the shell never waits on the network. Session restore is a
  // local read, but it still happens a beat after the first paint.
  const [loading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // A local-only build has no accounts; there is nothing to wait for.
    if (!IS_CLOUD_BUILD) {
      setReady(true);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const apply = async (nextSession: Session | null) => {
      if (cancelled) return;

      // The database on this device belongs to one account. Binding it happens
      // *before* the user is published, so no other account's content can be
      // rendered for even one frame.
      if (nextSession?.user) {
        try {
          await claimLocalDataForUser(nextSession.user.id);
        } catch (err) {
          console.warn('Failed to bind the local database to this account:', err);
        }
      }

      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setReady(true);
    };

    const fallback = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, SESSION_RESTORE_TIMEOUT_MS);

    void getSupabase()
      .then((supabase) => {
        if (cancelled) return;

        supabase.auth
          .getSession()
          .then(({ data }) => apply(data.session))
          .catch(() => apply(null));

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          // A signed-out device keeps no content: the data belongs to the
          // account that just left, not to whoever opens the app next.
          if (!nextSession) {
            void clearLocalUserData()
              .catch(() => {})
              .finally(() => {
                if (cancelled) return;
                setSession(null);
                setUser(null);
                setReady(true);
              });
            return;
          }

          void apply(nextSession);
        });

        unsubscribe = () => subscription.unsubscribe();
      })
      .catch(() => apply(null));

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      unsubscribe?.();
    };
  }, []);

  const signInWithOtp = useCallback(async (email: string) => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (!error && data.session) {
      setSession(data.session);
      setUser(data.user);
    }
    return { error };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error && data.session) {
      setSession(data.session);
      setUser(data.user);
    }
    return { error };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (!error && data.session) {
      setSession(data.session);
      setUser(data.user);
    }
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error };
  }, []);

  const resendConfirmationEmail = useCallback(async (email: string) => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setSession(null);
      setUser(null);
      // Only a completed sign-out gets here; offline or failed sign-outs keep
      // the local copy. Reload so no in-memory state survives the wipe.
      try {
        await clearLocalUserData();
        window.location.reload();
      } catch (err) {
        console.warn('Failed to clear local data after sign-out:', err);
      }
    }
    return { error };
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      ready,
      signInWithOtp,
      verifyOtp,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      resendConfirmationEmail,
      resetPasswordForEmail,
      signOut,
    }),
    [
      user,
      session,
      loading,
      ready,
      signInWithOtp,
      verifyOtp,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      resendConfirmationEmail,
      resetPasswordForEmail,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
