"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import styles from "./page.module.css";
import { AI_MODELS } from "@/config/models";

export default function IntegrationsPage() {
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newIntName, setNewIntName] = useState("");
    const [copiedKey, setCopiedKey] = useState(null);

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
            }
        } catch (e) {
            console.error("Failed to load integrations", e);
        } finally {
            setLoading(false);
        }
    };

    const saveIntegrations = async (updatedList) => {
        // Optimistically update UI immediately
        setIntegrations(updatedList);
        setSaving(true);
        setSaveSuccess(false);
        try {
            const res = await fetch("/api/integrations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ integrations: updatedList })
            });
            if (res.ok) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
            } else {
                const errData = await res.json().catch(() => ({}));
                console.error("Failed to save integrations:", errData);
            }
        } catch (e) {
            console.error("Failed to save", e);
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
        setShowModal(false);
        setNewIntName("");
    };

    const deleteIntegration = (id) => {
        if (confirm("Точно удалить эту интеграцию?")) {
            saveIntegrations(integrations.filter(i => i.id !== id));
        }
    };

    const addTask = (intId) => {
        const taskName = prompt("Введите ID задачи (например: worker или judge):");
        if (!taskName) return;

        const newList = integrations.map(int => {
            if (int.id === intId) {
                const newTask = {
                    id: taskName.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                    name: taskName,
                    allowedModels: ["all"]
                };
                return { ...int, tasks: [...(int.tasks || []), newTask] };
            }
            return int;
        });
        saveIntegrations(newList);
    };

    const deleteTask = (intId, taskId) => {
        const newList = integrations.map(int => {
            if (int.id === intId) {
                return { ...int, tasks: int.tasks.filter(t => t.id !== taskId) };
            }
            return int;
        });
        saveIntegrations(newList);
    };

    // Toggle a single model in the allowedModels array
    const toggleTaskModel = (intId, taskId, modelId) => {
        const newList = integrations.map(int => {
            if (int.id !== intId) return int;
            const newTasks = int.tasks.map(t => {
                if (t.id !== taskId) return t;

                if (modelId === "all") {
                    // If "all" is selected, clear specific models and set ["all"]
                    return { ...t, allowedModels: ["all"] };
                }

                // Remove "all" if a specific model is toggled
                let current = (t.allowedModels || []).filter(m => m !== "all");

                if (current.includes(modelId)) {
                    current = current.filter(m => m !== modelId);
                    // If nothing left, fall back to "all"
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

    if (loading) return <div className={styles.container}>Загрузка...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Интеграции (API)</h1>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {saveSuccess && (
                        <span style={{ color: 'var(--success-color, #28a745)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={16} /> Сохранено
                        </span>
                    )}
                    <button className={styles.createBtn} onClick={() => setShowModal(true)}>
                        <Plus size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Создать интеграцию
                    </button>
                </div>
            </div>

            <p style={{ marginBottom: 24, color: 'var(--text-secondary)' }}>
                Создавайте API-ключи и настраивайте доступы к моделям для ваших внешних приложений (ботов, скриптов, сайтов).
            </p>

            <div className={styles.grid}>
                {integrations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-card)', borderRadius: 12 }}>
                        Нет настроенных интеграций.
                    </div>
                ) : integrations.map((int) => (
                    <div key={int.id} className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h2 className={styles.cardTitle}>{int.name}</h2>
                            </div>
                            <button className={styles.deleteBtn} onClick={() => deleteIntegration(int.id)}>
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div>
                            <div className={styles.sectionTitle}>API Ключ</div>
                            <div className={styles.apiKeyContainer}>
                                <span>{int.apiKey}</span>
                                <button className={styles.copyBtn} onClick={() => copyToClipboard(int.apiKey, int.id)}>
                                    {copiedKey === int.id ? <Check size={18} color="green" /> : <Copy size={18} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <div className={styles.sectionTitle}>Настроенные задачи</div>
                            {(!int.tasks || int.tasks.length === 0) ? (
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Нет задач. Добавьте задачу, чтобы разрешить API запросы.</p>
                            ) : int.tasks.map((task) => (
                                <div key={task.id} className={styles.taskItem}>
                                    <div className={styles.taskHeader}>
                                        <span className={styles.taskName}>Задача: <code>{task.id}</code></span>
                                        <button className={styles.deleteBtn} onClick={() => deleteTask(int.id, task.id)}>Удалить</button>
                                    </div>
                                    <div style={{ marginTop: 8 }}>
                                        <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                                            Разрешённые модели:
                                        </label>

                                        {/* "All models" checkbox */}
                                        <label className={styles.checkboxLabel}>
                                            <input
                                                type="checkbox"
                                                checked={(task.allowedModels || []).includes("all")}
                                                onChange={() => toggleTaskModel(int.id, task.id, "all")}
                                            />
                                            <span>Все модели (определяет клиент)</span>
                                        </label>

                                        {/* Individual model checkboxes — shown only when "all" is NOT selected */}
                                        {!(task.allowedModels || []).includes("all") && (
                                            <div className={styles.modelCheckboxList}>
                                                {allModels.map(m => (
                                                    <label key={m.id} className={styles.checkboxLabel}>
                                                        <input
                                                            type="checkbox"
                                                            checked={(task.allowedModels || []).includes(m.id)}
                                                            onChange={() => toggleTaskModel(int.id, task.id, m.id)}
                                                        />
                                                        <span>{m.name} <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>({m.provider})</span></span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <button className={styles.addTaskBtn} onClick={() => addTask(int.id)}>
                                + Добавить задачу
                            </button>
                        </div>

                        <div style={{ marginTop: 24 }}>
                            <div className={styles.sectionTitle}>Как использовать (Пример)</div>
                            <div className={styles.codeBlock}>
{`curl -X POST https://YOUR_SITE_URL/api/integrations/chat \\
  -H "Authorization: Bearer ${int.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "task": "${int.tasks?.[0]?.id || 'worker'}",
    "prompt": "Твой промпт или данные",
    "model": "${
        (int.tasks?.[0]?.allowedModels?.[0] && int.tasks[0].allowedModels[0] !== 'all')
            ? int.tasks[0].allowedModels[0]
            : 'qwen/qwen3-32b'
    }"
  }'`}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

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
