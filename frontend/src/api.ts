import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("axis_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export async function loginRequest(email: string, password: string) {
  const response = await api.post("/api/auth/login", { email, password });

  localStorage.setItem("axis_token", response.data.access_token);
  localStorage.setItem("axis_user", JSON.stringify(response.data.user));

  return response.data.user;
}

export function clearSession() {
  localStorage.removeItem("axis_token");
  localStorage.removeItem("axis_user");
}
