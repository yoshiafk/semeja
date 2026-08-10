import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolved = theme === "system" ? getSystemTheme() : theme;
  root.classList.toggle("dark", resolved === "dark");
}

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("semeja-theme") as Theme) ?? "system";
  });

  const resolved: "light" | "dark" = theme === "system" ? getSystemTheme() : theme;

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("semeja-theme", theme);
  }, [theme]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Apply on mount (handles SSR hydration & page refresh)
  useEffect(() => {
    applyTheme(theme);
  }, []);

  const toggle = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  const setLight = () => setTheme("light");
  const setDark  = () => setTheme("dark");
  const setSystem = () => setTheme("system");

  return { theme, resolved, toggle, setLight, setDark, setSystem };
}
