"use client";

import { BrainCircuit, Sparkles, TrendingUp, History } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import Link from "next/link";
import styles from "./page.module.css";

export default function DashboardPage() {
    const { stats, history } = useAppContext();

    return (
        <div className={styles.wrapper}>
            <div>
                <h1 className={styles.headerTitle}>Обзор</h1>
                <p className={styles.headerDesc}>Добро пожаловать в AI Hub. Ваша статистика использования нейросетей.</p>
            </div>

            {/* Stats row */}
            <div className={styles.statsGrid}>
                <StatCard
                    title="Всего генераций"
                    value={stats.totalGenerations.toString()}
                    trend="За всё время"
                    trendColor="trendGreen"
                    icon={<BrainCircuit className={`${styles.statIcon} ${styles.scPurple}`} />}
                />
                <StatCard
                    title="Тексты (SEO)"
                    value={stats.textUsed.toString()}
                    trend="Использовано"
                    icon={<Sparkles className={`${styles.statIcon} ${styles.scAmber}`} />}
                />
                <StatCard
                    title="Распознано Фото"
                    value={stats.visionUsed.toString()}
                    trend="Использовано"
                    icon={<TrendingUp className={`${styles.statIcon} ${styles.scBlue}`} />}
                />
                <StatCard
                    title="Сэкономлено времени"
                    value={`~${(stats.totalGenerations * 5).toString()} мин`}
                    trend="Эффективность"
                    trendColor="trendGreen"
                    icon={<History className={`${styles.statIcon} ${styles.scGreen}`} />}
                />
            </div>

            {/* Recent Activity or Tools shortcuts */}
            <div className={styles.bottomGrid}>
                <div className={`bento-card ${styles.panel} ${styles.panelWide}`}>
                    <h2 className={styles.cardTitle}>Последние действия</h2>
                    <div className={styles.list}>
                        {history.length > 0 ? (
                            history.slice(0, 3).map((item) => (
                                <div key={item.id} className={styles.listItem}>
                                    <div className={item.type === 'vision' ? styles.itemIconWrap2 : styles.itemIconWrap1}>
                                        {item.type === 'vision' ? <TrendingUp className={styles.itemIcon2} /> : <Sparkles className={styles.itemIcon1} />}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <h3 className={styles.itemTitle}>{item.type === 'vision' ? 'Распознавание Изображения' : 'Генерация Текста'}</h3>
                                        <p className={styles.itemDesc} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.type === 'vision' ? item.data?.description : item.data}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                История пуста. Сделайте первую генерацию!
                            </div>
                        )}
                    </div>
                </div>

                <div className={`bento-card ${styles.panel}`}>
                    <h2 className={styles.cardTitle}>Быстрые действия</h2>
                    <div className={styles.actList}>
                        <Link href="/dashboard/generator" style={{ textDecoration: 'none' }}>
                            <button className={styles.btnPrimary}>
                                <Sparkles className={styles.btnIcon} />
                                Запустить ИИ
                            </button>
                        </Link>
                        <Link href="/dashboard/history" style={{ textDecoration: 'none' }}>
                            <button className={styles.btnOutline}>
                                <History className={styles.btnIcon} />
                                Вся история
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, trend, trendColor = "trendGray", icon }) {
    return (
        <div className={`bento-card ${styles.statCard}`}>
            <div className={styles.statTop}>
                <span className={styles.statTitle}>{title}</span>
                {icon}
            </div>
            <div>
                <div className={styles.statValue}>{value}</div>
                <div className={`${styles.statTrend} ${styles[trendColor]}`}>{trend}</div>
            </div>
        </div>
    );
}
