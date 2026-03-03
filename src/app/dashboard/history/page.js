"use client";

import { useAppContext } from "../../context/AppContext";
import { Copy, Check, Clock, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";
import styles from "./page.module.css";

export default function HistoryPage() {
    const { history } = useAppContext();
    const [copiedId, setCopiedId] = useState(null);

    const handleCopy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatDate = (isoString) => {
        const d = new Date(isoString);
        return d.toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className={styles.wrapper}>
            <div>
                <h1 className={styles.headerTitle}>История Генераций</h1>
                <p className={styles.headerDesc}>Ваши ранее сгенерированные SEO-описания и результаты распознавания.</p>
            </div>

            <div className={styles.historyList}>
                {history.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Clock size={48} opacity={0.2} />
                        <h2>История пуста</h2>
                        <p>Вы пока ничего не сгенерировали. Перейдите в раздел Генератор.</p>
                    </div>
                ) : (
                    history.map((item) => (
                        <div key={item.id} className={`bento-card ${styles.historyCard}`}>
                            <div className={styles.cardHeader}>
                                <div className={styles.badgeWrap}>
                                    <div className={`${styles.iconWrap} ${item.type === 'vision' ? styles.iconVision : styles.iconText}`}>
                                        {item.type === 'vision' ? <TrendingUp size={16} /> : <Sparkles size={16} />}
                                    </div>
                                    <span className={styles.typeLabel}>
                                        {item.type === 'vision' ? "Распознавание Изображения" : `SEO Описание (${item.model})`}
                                    </span>
                                </div>
                                <span className={styles.date}>{formatDate(item.timestamp)}</span>
                            </div>

                            {item.prompt && (
                                <div className={styles.promptArea}>
                                    <span className={styles.promptLabel}>Промпт:</span>
                                    <p className={styles.promptText}>{item.prompt}</p>
                                </div>
                            )}

                            <div className={styles.resultArea}>
                                {item.type === 'vision' ? (
                                    <div>
                                        {item.data?.tags && (
                                            <div className={styles.tagsContainer}>
                                                {item.data.tags.map((t, i) => <span key={i} className={styles.tag}>#{t}</span>)}
                                            </div>
                                        )}
                                        <p className={styles.descText}>{item.data?.description}</p>
                                    </div>
                                ) : (
                                    <p className={styles.resultText}>{item.data}</p>
                                )}
                            </div>

                            {item.type === 'text' && (
                                <div className={styles.cardFooter}>
                                    <button
                                        className={styles.btnCopy}
                                        onClick={() => handleCopy(item.data, item.id)}
                                    >
                                        {copiedId === item.id ? <Check size={16} className={styles.iconSuccess} /> : <Copy size={16} />}
                                        {copiedId === item.id ? "Скопировано" : "Копировать текст"}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
