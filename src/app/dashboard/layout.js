"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, Shapes, Menu, History, ChevronLeft, ChevronRight, Eye, Scan } from "lucide-react";
import styles from "./layout.module.css";

export default function DashboardLayout({ children }) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    const isActive = (path) => {
        return pathname === path ? styles.linkActive : styles.linkDisabled;
    };

    return (
        <div className={styles.container}>
            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""}`}>
                <div className={styles.srHeader}>
                    {!collapsed && (
                        <Link href="/" className={styles.logo}>
                            AI<span className={styles.hubText}>HUB</span>
                        </Link>
                    )}
                    <button
                        className={styles.collapseBtn}
                        onClick={() => setCollapsed(!collapsed)}
                        title={collapsed ? "Развернуть" : "Свернуть"}
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                <nav className={styles.nav}>
                    <Link href="/dashboard" className={isActive("/dashboard")} title="Сводка">
                        <LayoutDashboard className={pathname === "/dashboard" ? styles.linkActiveIcon : styles.linkIcon} />
                        {!collapsed && <span>Сводка</span>}
                    </Link>
                    <Link href="/dashboard/generator" className={isActive("/dashboard/generator")} title="Генератор">
                        <Shapes className={pathname === "/dashboard/generator" ? styles.linkActiveIcon : styles.linkIcon} />
                        {!collapsed && <span>Генератор + Распознавание</span>}
                    </Link>
                    <Link href="/dashboard/analysis" className={isActive("/dashboard/analysis")} title="Анализ">
                        <Eye className={pathname === "/dashboard/analysis" ? styles.linkActiveIcon : styles.linkIcon} />
                        {!collapsed && <span>Анализ ИИ</span>}
                    </Link>
                    <Link href="/dashboard/ocr" className={isActive("/dashboard/ocr")} title="Распознавание">
                        <Scan className={pathname === "/dashboard/ocr" ? styles.linkActiveIcon : styles.linkIcon} />
                        {!collapsed && <span>Распознавание (OCR)</span>}
                    </Link>
                    <Link href="/dashboard/history" className={isActive("/dashboard/history")} title="История">
                        <History className={pathname === "/dashboard/history" ? styles.linkActiveIcon : styles.linkIcon} />
                        {!collapsed && <span>История</span>}
                    </Link>
                </nav>

                <div className={styles.bottomNav}>
                    <Link href="/dashboard/settings" className={isActive("/dashboard/settings")} title="Настройки">
                        <Settings className={pathname === "/dashboard/settings" ? styles.linkActiveIcon : styles.linkIcon} />
                        {!collapsed && <span>Настройки</span>}
                    </Link>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className={styles.mainArea}>
                {/* Mobile Header */}
                <header className={styles.mobileHeader}>
                    <Link href="/" className={styles.logo}>AI HUB</Link>
                    <button className={styles.menuBtn}>
                        <Menu className={styles.menuIcon} />
                    </button>
                </header>

                {/* Page Content */}
                <main className={styles.content}>
                    <div className={styles.contentInner}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
