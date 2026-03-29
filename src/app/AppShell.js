"use client";

import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";

export default function AppShell({ children }) {
    return (
        <ThemeProvider>
            <AppProvider>{children}</AppProvider>
        </ThemeProvider>
    );
}
