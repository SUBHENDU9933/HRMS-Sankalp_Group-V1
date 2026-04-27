import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

// Attach token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sk_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      if (!path.includes("/login")) {
        localStorage.removeItem("sk_token");
        localStorage.removeItem("sk_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);
