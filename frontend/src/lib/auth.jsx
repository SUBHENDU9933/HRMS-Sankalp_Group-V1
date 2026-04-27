import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sk_user") || "null"); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("sk_token");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me")
      .then((r) => { setUser(r.data); localStorage.setItem("sk_user", JSON.stringify(r.data)); })
      .catch(() => { localStorage.removeItem("sk_token"); localStorage.removeItem("sk_user"); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("sk_token", data.access_token);
    localStorage.setItem("sk_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("sk_token");
    localStorage.removeItem("sk_user");
    setUser(null);
  };

  const refresh = async () => {
    const { data } = await api.get("/auth/me");
    localStorage.setItem("sk_user", JSON.stringify(data));
    setUser(data);
    return data;
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, refresh, isAdmin: user?.role === "admin", isManager: user?.role === "manager", isEmployee: user?.role === "employee" }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
