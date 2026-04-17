import { create } from "zustand";

interface AuthState {
  token: string | null;
  username: string | null;
  loggedIn: boolean;
  isAdmin: boolean;
  login: (token: string, username: string, isAdmin: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("token"),
  username: localStorage.getItem("username"),
  loggedIn: !!localStorage.getItem("token"),
  // Default to non-admin; the live value comes back with loginByToken on
  // reconnect. We don't trust localStorage for privilege decisions — but
  // caching it lets us render the right UI instantly on page reload before
  // the socket round-trip completes.
  isAdmin: localStorage.getItem("isAdmin") === "1",

  login: (token: string, username: string, isAdmin: boolean) => {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    localStorage.setItem("isAdmin", isAdmin ? "1" : "0");
    set({ token, username, isAdmin, loggedIn: true });
  },

  setIsAdmin: (isAdmin: boolean) => {
    localStorage.setItem("isAdmin", isAdmin ? "1" : "0");
    set({ isAdmin });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("isAdmin");
    set({ token: null, username: null, isAdmin: false, loggedIn: false });
  },
}));
