import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

const AuthCtx = createContext(null);

async function fetchMe(email) {
  if (!email) return null;
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (!email) { setUser(null); return null; }
    const emp = await fetchMe(email);
    setUser(emp);
    return emp;
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.email) { setUser(null); return; }
      fetchMe(session.user.email).then(setUser).catch(() => setUser(null));
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [refresh]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(), password,
    });
    if (error) throw error;
    const emp = await fetchMe(data.user.email);
    if (!emp) {
      await supabase.auth.signOut();
      throw new Error("No employee record linked to this login. Contact admin.");
    }
    if (emp.status !== "active") {
      await supabase.auth.signOut();
      throw new Error("Account inactive");
    }
    setUser(emp);
    return emp;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{
      user, loading, login, logout, refresh,
      isAdmin: user?.role === "admin",
      isManager: user?.role === "manager",
      isEmployee: user?.role === "employee",
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
