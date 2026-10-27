import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabase } from './cloud';
import { runWhenIdle } from './idle';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithOtp: (email: string) => Promise<{ error: AuthError | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: AuthError | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // Starts `false`: the shell never waits on the network. The session is
  // restored on idle and simply arrives a beat later.
  const [loading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    // Session restore is a network/auth concern, not a render concern, so it
    // runs after first paint and after the native bridge is up.
    runWhenIdle(() => {
      void getSupabase()
        .then((supabase) => {
          if (cancelled) return;

          supabase.auth
            .getSession()
            .then(({ data }) => {
              if (cancelled) return;
              setSession(data.session);
              setUser(data.session?.user ?? null);
            })
            .catch(() => {});

          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setUser(nextSession?.user ?? null);
          });

          unsubscribe = () => subscription.unsubscribe();
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
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
    }
    return { error };
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
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
