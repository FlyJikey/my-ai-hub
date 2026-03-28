"use client";

import { usePathname } from "next/navigation";
import { AppProvider } from "./context/AppContext";

export default function AppShell({ children }) {
    const pathname = usePathname();

    return <AppProvider>{children}</AppProvider>;
}
