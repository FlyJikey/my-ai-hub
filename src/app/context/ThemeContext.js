"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { THEME_STORAGE_KEY } from "./theme-shared";

const ThemeContext = createContext(null);

function getSystemTheme() {
    if (typeof window === "undefined") {
        return "dark";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme) {
    return theme === "system" ? getSystemTheme() : theme;
}

export function applyTheme(theme) {
    if (typeof document === "undefined") {
        return "dark";
    }

    const resolvedTheme = resolveTheme(theme);
    const root = document.documentElement;

    root.setAttribute("data-theme", resolvedTheme);
    root.setAttribute("data-theme-mode", theme);
    root.style.colorScheme = resolvedTheme;

    return resolvedTheme;
}

function getInitialThemeState() {
    if (typeof document === "undefined") {
        return { theme: "system", resolvedTheme: "dark" };
    }

    const root = document.documentElement;

    return {
        theme: root.getAttribute("data-theme-mode") || "system",
        resolvedTheme: root.getAttribute("data-theme") || "dark",
    };
}

export function ThemeProvider({ children }) {
    const [{ theme, resolvedTheme }, setThemeState] = useState(getInitialThemeState);

    useEffect(() => {
        if (theme !== "system") {
            return;
        }

        const media = window.matchMedia("(prefers-color-scheme: dark)");

        const handleSystemThemeChange = () => {
            setThemeState((current) => ({
                ...current,
                resolvedTheme: applyTheme("system"),
            }));
        };

        media.addEventListener("change", handleSystemThemeChange);

        return () => {
            media.removeEventListener("change", handleSystemThemeChange);
        };
    }, [theme]);

    const setTheme = (value) => {
        localStorage.setItem(THEME_STORAGE_KEY, value);
        setThemeState({
            theme: value,
            resolvedTheme: applyTheme(value),
        });
    };

    const value = useMemo(() => ({
        theme,
        resolvedTheme,
        setTheme,
    }), [resolvedTheme, theme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }

    return context;
}
