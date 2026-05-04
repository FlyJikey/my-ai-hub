"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
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
    const [expandedId, setExpandedId] = useState(null);

    const allModels = AI_MODELS.text.map(m => ({ id: m.id, name: m.name, provider: m.provider }));

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const fetchIntegrations = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/integrations");
            const data = await res.json();
            if (data.integrations) {
                setIntegrations(data.integrations);
            } else if (data.error) {
                setSaveError("Ошибка загрузки: " + data.error);
                setSaveStatus("error");
            }
        } catch (e) {
            setSaveError("Ошибка загрузки: " + e.message);
            setSaveStatus("error");
        } finally {
            setLoading(false);
        }
    };

    const saveIntegrations = async (updatedList) => {
        // Optimistically update UI
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
            setSaveError("Сетевая ошибка: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const generateApiKey = () => {
        return 'sk-aihub-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const createIntegration = () => {
        if (!newIntName.trim()) return;
        const newInt = {
            id: Date.now().toString(),
            name: newIntName,
            apiKey: generateApiKey(),
            tasks: []
        };
        const newList = [...integrations, newInt];
        saveIntegrations(newList);
        setExpandedId(newInt.id);
        setShowModal(false);
        setNewIntName("");
    };

    const deleteIntegration = (id) => {
        if (confirm("Точно удалить эту интеграцию?")) {
            if (expandedId === id) setExpandedId(null);
            saveIntegrations(integrations.filter(i => i.id !== id));
        }
    };

    const addTask = (intId) => {
        const taskName = prompt("Введите ID задачи (например: worker или judge):");
        if (!taskName) return;
        const newList = integrations.map(int => {
            if (int.id !== intId) return int;
            const newTask = {
                id: taskName.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                name: taskName,
                allowedModels: ["all"]
            };
            return { ...int, tasks: [...(int.tasks || []), newTask] };
        });
        saveIntegrations(newList);
    };

    const deleteTask = (intId, taskId) => {
        const newList = integrations.map(int => {
            if (int.id !== intId) return int;
            return { ...int, tasks: int.tasks.filter(t => t.id !== taskId) };
        });
        saveIntegrations(newList);
    };

    const toggleTaskModel = (intId, taskId, modelId) => {
        const newList = integrations.map(int => {
            if (int.id !== intId) return int;
            const newTasks = int.tasks.map(t => {
                if (t.id !== taskId) return t;

                if (modelId === "all") {
                    return { ...t, allowedModels: ["all"] };
                }

                // Deselect "all", toggle specific model
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
        saveIntegrations(newList);
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

    if (loading) return <div className={styles.container}>Загрузка...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Интеграции (API)</h1>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {saving && <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Сохранение...</span>}
                    {saveStatus === "ok" && (
                        <span style={{ color: '#28a745', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={15} /> Сохранено
                        </span>
                    )}
                    <button className={styles.createBtn} onClick={() => setShowModal(true)}>
                        <Plus size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Создать интеграцию
                    </button>
                </div>
            </div>

            {saveStatus === "error" && (
                <div className={styles.errorBanner}>
                    <AlertCircle size={16} />
                    <span>{saveError}</span>
                </div>
            )}

            <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
                Создавайте API-ключи для внешних приложений (ботов, скриптов). Endpoint: <code>/api/integrations/chat</code>
            </p>

            {integrations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    Нет настроенных интеграций. Нажмите «Создать интеграцию».
                </div>
            ) : (
                <div className={styles.list}>
                    {integrations.map((int) => {
                        const isExpanded = expandedId === int.id;
                        return (
                            <div key={int.id} className={styles.listItem}>
                                {/* Row header — always visible */}
                                <div className={styles.listRow} onClick={() => setExpandedId(isExpanded ? null : int.id)}>
                                    <div className={styles.listRowLeft}>
                                        <span className={styles.listName}>{int.name}</span>
                                        <span className={styles.listMeta}>
                                            {int.tasks?.length || 0} задач · {int.apiKey.slice(0, 20)}...
                                        </span>
                                    </div>
                                    <div className={styles.listRowRight}>
                                        <button
                                            className={styles.iconBtn}
                                            onClick={(e) => { e.stopPropagation(); copyToClipboard(int.apiKey, int.id); }}
                                            title="Скопировать API ключ"
                                        >
                                            {copiedKey === int.id ? <Check size={16} color="#28a745" /> : <Copy size={16} />}
                                        </button>
                                        <button
                                            className={styles.iconBtnDanger}
                                            onClick={(e) => { e.stopPropagation(); deleteIntegration(int.id); }}
                                            title="Удалить"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className={styles.listDetails}>
                                        {/* API Key */}
                                        <div className={styles.sectionTitle}>API Ключ</div>
                                        <div className={styles.apiKeyContainer}>
                                            <span>{int.apiKey}</span>
                                            <button className={styles.copyBtn} onClick={() => copyToClipboard(int.apiKey, int.id + '_full')}>
                                                {copiedKey === int.id + '_full' ? <Check size={16} color="#28a745" /> : <Copy size={16} />}
                                            </button>
                                        </div>

                                        {/* Tasks */}
                                        <div className={styles.sectionTitle}>Задачи</div>
                                        {(!int.tasks || int.tasks.length === 0) ? (
                                            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 12px' }}>
                                                Нет задач. Добавьте задачу чтобы разрешить API запросы.
                                            </p>
                                        ) : int.tasks.map((task) => {
                                            const isAll = (task.allowedModels || []).includes("all");
                                            return (
                                                <div key={task.id} className={styles.taskItem}>
                                                    <div className={styles.taskHeader}>
                                                        <span className={styles.taskName}>Задача: <code>{task.id}</code></span>
                                                        <button className={styles.deleteBtn} onClick={() => deleteTask(int.id, task.id)}>Удалить</button>
                                                    </div>

                                                    <div style={{ marginTop: 8 }}>
                                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                                            Разрешённые модели:
                                                            {!isAll && (
                                                                <span style={{ marginLeft: 8, color: 'var(--primary-color, #007bff)', fontWeight: 500 }}>
                                                                    выбрано {task.allowedModels.length}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* "All" toggle */}
                                                        <label className={styles.checkboxLabel}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isAll}
                                                                onChange={() => toggleTaskModel(int.id, task.id, "all")}
                                                            />
                                                            <span>Все модели (клиент выбирает сам)</span>
                                                        </label>

                                                        {/* Individual models — only when "all" is NOT checked */}
                                                        {!isAll && (
                                                            <div className={styles.modelCheckboxList}>
                                                                {allModels.map(m => (
                                                                    <label key={m.id} className={styles.checkboxLabel}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={(task.allowedModels || []).includes(m.id)}
                                                                            onChange={() => toggleTaskModel(int.id, task.id, m.id)}
                                                                        />
                                                                        <span>
                                                                            {m.name}
                                                                            <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 4 }}>({m.provider})</span>
                                                                        </span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Summary of selected models */}
                                                        {!isAll && task.allowedModels.length > 0 && (
                                                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                                                                Выбрано: {task.allowedModels.map(id => getModelName(id)).join(", ")}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        <button className={styles.addTaskBtn} onClick={() => addTask(int.id)}>
                                            + Добавить задачу
                                        </button>

                                        {/* Usage example */}
                                        <div className={styles.sectionTitle} style={{ marginTop: 20 }}>Пример запроса</div>
                                        <div className={styles.codeBlock}>
{`curl -X POST https://YOUR_SITE/api/integrations/chat \\
  -H "Authorization: Bearer ${int.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "task": "${int.tasks?.[0]?.id || 'worker'}",
    "prompt": "Твой промпт",
    "model": "${
        int.tasks?.[0]?.allowedModels?.[0] !== 'all' && int.tasks?.[0]?.allowedModels?.[0]
            ? int.tasks[0].allowedModels[0]
            : 'qwen/qwen3-32b'
    }"
  }'`}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
