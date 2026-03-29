import { THEME_STORAGE_KEY } from "./context/ThemeContext";

export const themeInitScript = `
(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const root = document.documentElement;
  const savedTheme = localStorage.getItem(storageKey) || "system";
  const resolvedTheme = savedTheme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : savedTheme;

  root.setAttribute("data-theme", resolvedTheme);
  root.setAttribute("data-theme-mode", savedTheme);
  root.style.colorScheme = resolvedTheme;
})();`;
