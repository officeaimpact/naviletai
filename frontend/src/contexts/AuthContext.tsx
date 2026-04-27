"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  loading: boolean;
  supabase: SupabaseClient | null;
  signUp: (email: string, password: string, name?: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithProvider: (provider: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  supabase: null,
  signUp: async () => null,
  signIn: async () => null,
  signInWithProvider: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      loadingRef.current = false;
      return;
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Stale/invalid refresh token — clear it silently
        supabase.auth.signOut().catch(() => {});
      }
      setUser(session?.user ?? null);
      setLoading(false);
      loadingRef.current = false;
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (loadingRef.current) {
        setLoading(false);
        loadingRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      if (!supabase) return "Supabase не настроен";
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name || email.split("@")[0] } },
      });
      if (error) return error.message;

      if (
        data.user &&
        (!data.user.identities || data.user.identities.length === 0)
      ) {
        return "User already registered";
      }

      if (data.session) {
        setUser(data.session.user);
        return null;
      }

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        return "Аккаунт создан. Проверьте почту для подтверждения.";
      }
      if (signInData.user) setUser(signInData.user);
      return null;
    },
    [supabase]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return "Supabase не настроен";
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return error.message;
      if (data.user) setUser(data.user);
      return null;
    },
    [supabase]
  );

  const signInWithProvider = useCallback(
    async (provider: string) => {
      if (!supabase) return;
      await supabase.auth.signInWithOAuth({
        provider: provider as "google",
        options: {
          redirectTo: window.location.origin + window.location.pathname,
          skipBrowserRedirect: false,
        },
      });
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{ user, loading, supabase, signUp, signIn, signInWithProvider, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
