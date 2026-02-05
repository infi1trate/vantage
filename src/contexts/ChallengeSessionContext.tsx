import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface ChallengeContext {
  id: string;
  title: string;
}

interface ChallengeSessionContextType {
  /** Currently active challenge context (from starting a recording via challenge) */
  challengeContext: ChallengeContext | null;
  /** Set challenge context when starting a recording from a challenge */
  setChallengeContext: (context: ChallengeContext | null) => void;
  /** Clear the challenge context (on dismiss or navigation) */
  clearChallengeContext: () => void;
  /** Session ID from the just-completed recording */
  completedSessionId: string | null;
  /** Mark a session as completed (triggers the challenge prompt) */
  markSessionCompleted: (sessionId: string) => void;
  /** Clear the completed session state */
  clearCompletedSession: () => void;
}

const ChallengeSessionContext = createContext<ChallengeSessionContextType | null>(null);

// Storage key for persisting challenge context across page navigations
const STORAGE_KEY = "vantage_challenge_context";

// Context expires after 30 minutes (in case user abandons recording)
const CONTEXT_EXPIRY_MS = 30 * 60 * 1000;

interface StoredChallengeContext {
  challenge: ChallengeContext;
  createdAt: number;
}

export function ChallengeSessionProvider({ children }: { children: ReactNode }) {
  const [challengeContext, setChallengeContextState] = useState<ChallengeContext | null>(() => {
    // Restore from sessionStorage on mount
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredChallengeContext = JSON.parse(stored);
        // Check if expired
        if (Date.now() - parsed.createdAt < CONTEXT_EXPIRY_MS) {
          return parsed.challenge;
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    return null;
  });
  
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);

  // Persist to sessionStorage when context changes
  useEffect(() => {
    if (challengeContext) {
      const stored: StoredChallengeContext = {
        challenge: challengeContext,
        createdAt: Date.now(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [challengeContext]);

  const setChallengeContext = useCallback((context: ChallengeContext | null) => {
    setChallengeContextState(context);
  }, []);

  const clearChallengeContext = useCallback(() => {
    setChallengeContextState(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const markSessionCompleted = useCallback((sessionId: string) => {
    setCompletedSessionId(sessionId);
  }, []);

  const clearCompletedSession = useCallback(() => {
    setCompletedSessionId(null);
  }, []);

  return (
    <ChallengeSessionContext.Provider
      value={{
        challengeContext,
        setChallengeContext,
        clearChallengeContext,
        completedSessionId,
        markSessionCompleted,
        clearCompletedSession,
      }}
    >
      {children}
    </ChallengeSessionContext.Provider>
  );
}

export function useChallengeSession() {
  const context = useContext(ChallengeSessionContext);
  if (!context) {
    throw new Error("useChallengeSession must be used within a ChallengeSessionProvider");
  }
  return context;
}

// Optional hook that doesn't throw (for components that may be outside the provider)
export function useChallengeSessionOptional() {
  return useContext(ChallengeSessionContext);
}
