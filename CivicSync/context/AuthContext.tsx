import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };
  const signInWithGoogle = async () => {
    // Let makeRedirectUri automatically generate the correct deep link for the Dev Client
    const redirectUri = makeRedirectUri();
    console.log('Attempting OAuth with redirectUri: ', redirectUri);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) return { error: error.message };

    if (data?.url) {
      try {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (res.type === 'success' && res.url) {
          // URLs from Supabase can have tokens in the hash (#) or query string (?)
          // Replacing # with ? lets Linking.parse safely extract all parameters
          const parsedUrl = Linking.parse(res.url.replace('#', '?'));
          const params = (parsedUrl.queryParams || {}) as Record<string, string>;

          if (params.code) {
            const { error: sessionError } = await supabase.auth.exchangeCodeForSession(params.code);
            if (sessionError) return { error: sessionError.message };
            return { error: null };
          }

          if (params.access_token && params.refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
            });
            if (sessionError) return { error: sessionError.message };
            return { error: null };
          }
        }
        return { error: 'Authentication canceled or failed.' };
      } catch (err) {
        return { error: 'Failed to open browser.' };
      }
    }
    return { error: 'No URL returned from Supabase.' };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signInWithGoogle, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
