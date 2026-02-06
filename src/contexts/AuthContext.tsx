import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// Whitelisted emails for challenge admin access
// In production, this should come from a secure backend/database
const CHALLENGE_ADMIN_EMAILS = [
  "admin@vantage.gg",
  "challenges@vantage.gg",
  "b@b.com",
];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True if user is whitelisted for challenge admin access */
  isChallengeAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isChallengeAdmin: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Compute isChallengeAdmin based on user email
  const isChallengeAdmin = useMemo(() => {
    if (!user?.email) return false;
    return CHALLENGE_ADMIN_EMAILS.includes(user.email.toLowerCase());
  }, [user?.email]);

  return (
    <AuthContext.Provider value={{ user, session, loading, isChallengeAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
