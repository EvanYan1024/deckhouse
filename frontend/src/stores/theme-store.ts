import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");

  if (theme === "system") {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(systemDark ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
}

const stored = (localStorage.getItem("theme") as Theme) ?? "system";
applyTheme(stored);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: stored,

  setTheme: (theme: Theme) => {
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    set({ theme });
  },
}));
