import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { supabase } from '../lib/supabase';
import { createGoogleProvider, firebaseConfigured, getFirebaseAuth, initFirebaseAnalytics } from '../lib/firebase';
import { friendlyAuthError, friendlyGoogleError } from '../lib/authErrors';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initFirebaseAnalytics();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch((err: unknown) => {
        // A failed session read should show the login page, not spin forever.
        console.error('Could not read the session', err);
        if (!active) return;
        setSession(null);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? friendlyAuthError(error) : null;
      },
      signUp: async (email, password, fullName) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        return error ? friendlyAuthError(error) : null;
      },
      signInWithGoogle: async () => {
        // Firebase handles the Google popup. Supabase then creates its own session from Google's ID token,
        // so the rest of the app (profiles, RLS, data) keeps working unchanged.
        if (!firebaseConfigured) {
          return 'Google sign-in is not configured yet. Add the VITE_FIREBASE_* values to your .env file.';
        }
        try {
          const result = await signInWithPopup(getFirebaseAuth(), createGoogleProvider());
          const idToken = GoogleAuthProvider.credentialFromResult(result)?.idToken;
          if (!idToken) return 'Google sign-in did not return a token. Try again.';

          const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
          if (error) return friendlyAuthError(error);
          return null;
        } catch (err) {
          return friendlyGoogleError(err);
        }
      },
      signOut: async () => {
        // Clear the Firebase popup session too, so the next Google sign-in asks which account to use.
        if (firebaseConfigured) {
          await firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
        }
        const { error } = await supabase.auth.signOut();
        return error ? error.message : null;
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
