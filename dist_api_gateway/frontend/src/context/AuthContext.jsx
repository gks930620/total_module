import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authFetch, toApiError } from "../lib/http.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  const loadMe = async () => {
    try {
      const response = await authFetch("/api/users/me", { credentials: "include" });
      if (!response.ok) {
        setUser(null);
        setStatus("guest");
        return null;
      }

      const result = await response.json();
      setUser(result?.data ?? null);
      setStatus("authenticated");
      return result?.data ?? null;
    } catch {
      setUser(null);
      setStatus("guest");
      return null;
    }
  };

  useEffect(() => {
    loadMe();
  }, []);

  const login = async ({ username, password }) => {
    const response = await fetch("/api/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/html",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw await toApiError(response);
    }

    return loadMe();
  };

  const logout = async () => {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    setUser(null);
    setStatus("guest");
  };

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated" && !!user,
      refreshUser: loadMe,
      login,
      logout,
    }),
    [user, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
