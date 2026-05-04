"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check, ChevronRight, ArrowLeft, AlertCircle } from "lucide-react";
import styles from "./page.module.css";
import { AI_MODELS } from "@/config/models";

export default function IntegrationsPage() {
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // null | 'ok' | 'error'
    const [saveError, setSaveError] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [newIntName, setNewIntName] = useState("");
    const [copiedKey, setCopiedKey] = useState(null);
    const [selectedId, setSelectedId] = useState(null); // null = list view, id = detail view

    const allModels = AI_MODELS.text.map(m => ({ id: m.id, name: m.name, provider: m.provider }));
    const selectedInt = integrations.find(i => i.id === selectedId) || null;

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const fetchIntegrations = async () => {
        setLoading(true);
        setSaveStatus(null);
        setSaveError("");
        try {
            const res = await fetch("/api/integrations");
            const data = await res.json();
            if (data.integrations) {
                setIntegrations(data.integrations);
            } else if (data.error) {
                setSaveStatus("error");
                setSaveError("Ошибка загрузки: " + data.error);
            }
        } catch (e) {
            setSaveStatus("error");
            setSaveError("Ошибка соединения: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const persistIntegrations = async (updatedList) => {
        setIntegrations(updatedList);
        setSaving(true);
        setSaveStatus(null);
        setSaveError("");
        try {
            const res = await fetch("/api/integrations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ integrations: updatedList })
            });
            const data = await res.json();
            if (res.ok) {
                setSaveStatus("ok");
                setTimeout(() => setSaveStatus(null), 2500);
            } else {
                setSaveStatus("error");
                setSaveError(data.error || "Неизвестная ошибка сохранения");
            }
        } catch (e) {
            setSaveStatus("error");
            setSaveError("Ошибка соединения: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const generateApiKey = () =>
        'sk-aihub-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const createIntegration = () => {
        if (!newIntName.trim()) return;
        const newInt = {
            id: Date.now().toString(),
            name: newIntName,
            apiKey: generateApiKey(),
            tasks: []
        };
        persistIntegrations([...integrations, newInt]);
        setSelectedId(newInt.id);
        setShowModal(false);
        setNewIntName("");
    };

    const deleteIntegration = (id) => {
        if (!confirm("Точно удалить эту интеграцию?")) return;
        persistIntegrations(integrations.filter(i => i.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const addTask = () => {
        if (!selectedId) return;
        const taskName = prompt("Введите ID задачи (например: worker или judge):");
        if (!taskName) return;
        const newList = integrations.map(int => {
            if (int.id !== selectedId) return int;
            const newTask = {
                id: taskName.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                name: taskName,
                allowedModels: ["all"]
            };
            return { ...int, tasks: [...(int.tasks || []), newTask] };
        });
        persistIntegrations(newList);
    };

    const deleteTask = (taskId) => {
        const newList = integrations.map(int => {
            if (int.id !== selectedId) return int;
            return { ...int, tasks: int.tasks.filter(t => t.id !== taskId) };
        });
        persistIntegrations(newList);
    };

    const toggleTaskModel = (taskId, modelId) => {
        const newList = integrations.map(int => {
            if (int.id !== selectedId) return int;
            const newTasks = int.tasks.map(t => {
                if (t.id !== taskId) return t;
                if (modelId === "all") {
                    return { ...t, allowedModels: ["all"] };
                }
                let current = (t.allowedModels || []).filter(m => m !== "all");
                if (current.includes(modelId)) {
                    current = current.filter(m => m !== modelId);
                    if (current.length === 0) current = ["all"];
                } else {
                    current = [...current, modelId];
                }
                return { ...t, allowedModels: current };
            });
            return { ...int, tasks: newTasks };
        });
        persistIntegrations(newList);
    };

    const copyToClipboard = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const getModelName = (modelId) => {
        if (modelId === "all") return "Все модели";
        return allModels.find(m => m.id === modelId)?.name || modelId;
    };

    if (loading) return <div className={styles.container}><p>Загрузка...</p></div>;

    // ── DETAIL VIEW ──────────────────────────────────────────────────────────
    if (selectedId && selectedInt) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <button className={styles.backBtn} onClick={() => setSelectedId(null)}>
                        <ArrowLeft size={16} /> Назад к списку
                    </button>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {saving && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Сохранение...</span>}
                        {saveStatus === "ok" && (
                            <span style={{ fontSize: 13, color: '#28a745', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Check size={14} /> Сохранено
                            </span>
                        )}
                        <button className={styles.deleteBtnRed} onClick={() => deleteIntegration(selectedId)}>
                            <Trash2 size={15} /> Удалить интеграцию
                        </button>
                    </div>
                </div>

                {saveStatus === "error" && (
                    <div className={styles.errorBanner}>
                        <AlertCircle size={15} /> {saveError}
                    </div>
                )}

                <h2 className={styles.detailTitle}>{selectedInt.name}</h2>

                {/* API Key */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>API Ключ</div>
                    <div className={styles.apiKeyContainer}>
                        <span className={styles.apiKeyText}>{selectedInt.apiKey}</span>
                        <button className={styles.copyBtn} onClick={() => copyToClipboard(selectedInt.apiKey, 'key')}>
                            {copiedKey === 'key' ? <Check size={16} color="#28a745" /> : <Copy size={16} />}
                        </button>
                    </div>
                </div>

                {/* Tasks */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>Задачи</div>
                    {(!selectedInt.tasks || selectedInt.tasks.length === 0) ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 12px' }}>
                            Нет задач. Добавьте задачу чтобы разрешить API запросы.
                        </p>
                    ) : selectedInt.tasks.map((task) => {
                        const isAll = (task.allowedModels || []).includes("all");
                        const selectedModels = isAll ? [] : (task.allowedModels || []);
                        return (
                            <div key={task.id} className={styles.taskItem}>
                                <div className={styles.taskHeader}>
                                    <span className={styles.taskName}>Задача: <code>{task.id}</code></span>
                                    <button className={styles.deleteBtn} onClick={() => deleteTask(task.id)}>Удалить</button>
                                </div>

                                <div style={{ marginTop: 10 }}>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                        Разрешённые модели:
                                        {!isAll && (
                                            <span style={{ marginLeft: 8, color: 'var(--primary-color, #007bff)', fontWeight: 600 }}>
                                                выбрано {selectedModels.length}
                                            </span>
                                        )}
                                    </div>

                                    {/* All models toggle */}
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isAll}
                                            onChange={() => toggleTaskModel(task.id, "all")}
                                        />
                                        <span>Все модели (клиент выбирает сам)</span>
                                    </label>

                                    {/* Individual models list */}
                                    {!isAll && (
                                        <div className={styles.modelCheckboxList}>
                                            {allModels.map(m => (
                                                <label key={m.id} className={styles.checkboxLabel}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedModels.includes(m.id)}
                                                        onChange={() => toggleTaskModel(task.id, m.id)}
                                                    />
                                                    <span>
                                                        {m.name}
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 6 }}>
                                                            ({m.provider})
                                                        </span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {!isAll && selectedModels.length > 0 && (
                                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                                            Выбрано: {selectedModels.map(id => getModelName(id)).join(", ")}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <button className={styles.addTaskBtn} onClick={addTask}>+ Добавить задачу</button>
                </div>

                {/* Usage example */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>Пример запроса</div>
                    <div className={styles.codeBlock}>
{`curl -X POST https://YOUR_SITE/api/integrations/chat \\
  -H "Authorization: Bearer ${selectedInt.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "task": "${selectedInt.tasks?.[0]?.id || 'worker'}",
    "prompt": "Твой промпт",
    "model": "${
        selectedInt.tasks?.[0]?.allowedModels?.[0] !== 'all' && selectedInt.tasks?.[0]?.allowedModels?.[0]
            ? selectedInt.tasks[0].allowedModels[0]
            : 'qwen/qwen3-32b'
    }"
  }'`}
                    </div>
                </div>
            </div>
        );
    }

    // ── LIST VIEW ────────────────────────────────────────────────────────────
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Интеграции (API)</h1>
                <button className={styles.createBtn} onClick={() => setShowModal(true)}>
                    <Plus size={17} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Создать интеграцию
                </button>
            </div>

            {saveStatus === "error" && (
                <div className={styles.errorBanner}>
                    <AlertCircle size={15} /> {saveError}
                </div>
            )}

            <p style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: 14 }}>
                Создавайте API-ключи для внешних приложений. Endpoint: <code>/api/integrations/chat</code>
            </p>

            {integrations.length === 0 ? (
                <div className={styles.emptyState}>
                    Нет интеграций. Нажмите «Создать интеграцию».
                </div>
            ) : (
                <div className={styles.list}>
                    {integrations.map((int) => (
                        <div key={int.id} className={styles.listItem} onClick={() => setSelectedId(int.id)}>
                            <div className={styles.listItemLeft}>
                                <span className={styles.listName}>{int.name}</span>
                                <span className={styles.listMeta}>
                                    {int.tasks?.length || 0} задач · {int.apiKey.slice(0, 24)}...
                                </span>
                            </div>
                            <div className={styles.listItemRight}>
                                <button
                                    className={styles.iconBtn}
                                    title="Скопировать ключ"
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(int.apiKey, int.id); }}
                                >
                                    {copiedKey === int.id ? <Check size={15} color="#28a745" /> : <Copy size={15} />}
                                </button>
                                <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h2 style={{ marginTop: 0 }}>Новая интеграция</h2>
                        <div style={{ marginTop: 16 }}>
                            <label style={{ fontSize: 14, fontWeight: 500 }}>Название (например: VPN Manager)</label>
                            <input
                                autoFocus
                                className={styles.input}
                                value={newIntName}
                                onChange={(e) => setNewIntName(e.target.value)}
                                placeholder="Введите название..."
                                onKeyDown={(e) => e.key === 'Enter' && createIntegration()}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Отмена</button>
                            <button className={styles.submitBtn} onClick={createIntegration}>Создать</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
