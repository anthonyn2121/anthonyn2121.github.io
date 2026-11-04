import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "night" | "day";

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = "theme";

const stored = (): Theme | null => {
  try {
    const t = localStorage.getItem(KEY);
    return t === "day" || t === "night" ? t : null;
  } catch {
    return null;
  }
};

/**
 * Follows the system light/dark setting until the visitor picks a theme;
 * only an explicit choice is saved. index.html applies the same logic
 * before first paint so there's no flash.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || "night",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (!stored()) setThemeState(mq.matches ? "day" : "night");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage blocked: the theme still applies for this visit */
    }
  }, []);

  const toggle = useCallback(() => setTheme(theme === "night" ? "day" : "night"), [setTheme, theme]);

  return <Ctx.Provider value={{ theme, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}
