"use client";

import { useState, useCallback, useEffect } from "react";

interface User {
  name: string;
  email: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

const STORAGE_KEY = "navylet_auth";

function loadAuth(): AuthState {
  if (typeof window === "undefined") return { user: null, isAuthenticated: false };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { user: null, isAuthenticated: false };
}

function saveAuth(state: AuthState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, isAuthenticated: false });

  useEffect(() => {
    setState(loadAuth());
  }, []);

  const login = useCallback((email: string, _password: string) => {
    const user: User = {
      name: email.split("@")[0],
      email,
    };
    const newState = { user, isAuthenticated: true };
    setState(newState);
    saveAuth(newState);
    return true;
  }, []);

  const register = useCallback(
    (name: string, email: string, _password: string) => {
      const user: User = { name, email };
      const newState = { user, isAuthenticated: true };
      setState(newState);
      saveAuth(newState);
      return true;
    },
    []
  );

  const logout = useCallback(() => {
    const newState = { user: null, isAuthenticated: false };
    setState(newState);
    saveAuth(newState);
  }, []);

  const updateProfile = useCallback(
    (updates: Partial<User>) => {
      if (!state.user) return;
      const updated = { ...state.user, ...updates };
      const newState = { user: updated, isAuthenticated: true };
      setState(newState);
      saveAuth(newState);
    },
    [state.user]
  );

  return {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    login,
    register,
    logout,
    updateProfile,
  };
}
