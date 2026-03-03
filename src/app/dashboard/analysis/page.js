"use client";

import { useAppContext } from "../../context/AppContext";
import styles from "./page.module.css";
import { Eye, Clock, Cpu, FileText } from "lucide-react";

export default function AnalysisPage() {
    const { analysisLogs } = useAppContext();

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Eye size={24} />
                <h2>Анализ ИИ</h2>
                <span className={styles.subtitle}>Как нейросеть видит фото и строит промпт</span>
            </div>

            {analysisLogs.length === 0 ? (
                <div className={styles.emptyState}>
                    <Eye size={48} opacity={0.3} />
                    <h3>Нет данных анализа</h3>
                    <p>Отправьте фото товара в Генераторе, и здесь появится<br />информация о том, как ИИ видит фото и какой промпт был отправлен.</p>
                </div>
            ) : (
                <div className={styles.logsList}>
                    {analysisLogs.map((log) => (
                        <div key={log.id} className={styles.logCard}>
                            <div className={styles.logHeader}>
                                <div className={styles.logTime}>
                                    <Clock size={14} />
                                    {new Date(log.timestamp).toLocaleString("ru-RU")}
                                </div>
                                <div className={styles.logModels}>
                                    <span className={styles.modelTag}>👁️ {log.visionModel}</span>
                                    <span className={styles.modelTag}>📝 {log.textModel}</span>
                                </div>
                            </div>

                            {log.userPrompt && (
                                <div className={styles.logUserPrompt}>
                                    📋 Задача: <strong>{log.userPrompt}</strong>
                                </div>
                            )}

                            {/* Vision Section */}
                            <div className={styles.section}>
                                <div className={styles.sectionTitle}>
                                    <Eye size={16} /> Что увидела нейросеть
                                </div>
                                <div className={styles.sectionContent}>
                                    <div className={styles.visionField}>
                                        <span className={styles.fieldLabel}>Товар:</span>
                                        <span>{log.visionResult.productName || "Не определено"}</span>
                                    </div>
                                    <div className={styles.visionField}>
                                        <span className={styles.fieldLabel}>Описание:</span>
                                        <span>{log.visionResult.description || "Нет"}</span>
                                    </div>

                                    {log.visionResult.attributes && Object.keys(log.visionResult.attributes).length > 0 && (
                                        <div className={styles.attributesBlock}>
                                            <span className={styles.fieldLabel}>Характеристики:</span>
                                            <div className={styles.attrGrid}>
                                                {Object.entries(log.visionResult.attributes).map(([k, v]) => (
                                                    <div key={k} className={styles.attrItem}>
                                                        <span className={styles.attrKey}>{k}</span>
                                                        <span className={styles.attrVal}>{v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {log.visionResult.tags && log.visionResult.tags.length > 0 && (
                                        <div className={styles.tagsRow}>
                                            <span className={styles.fieldLabel}>Теги:</span>
                                            <div className={styles.tagsList}>
                                                {log.visionResult.tags.map((tag, i) => (
                                                    <span key={i} className={styles.tag}>{tag}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Prompt Section */}
                            <div className={styles.section}>
                                <div className={styles.sectionTitle}>
                                    <FileText size={16} /> Промпт отправленный текстовой модели
                                </div>
                                <pre className={styles.promptBlock}>{log.contextualPrompt}</pre>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
