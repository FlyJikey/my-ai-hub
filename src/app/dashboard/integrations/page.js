"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check, ChevronRight, ArrowLeft, AlertCircle, BookOpen, X } from "lucide-react";
import styles from "./page.module.css";
import { AI_MODELS } from "@/config/models";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://your-site.vercel.app";

// System prompts for AI agents
const SYSTEM_PROMPTS = {
    worker: `Ты — Сотрудник ИИ (Worker). Твоя задача — анализировать технические данные, логи и конфигурации, и предлагать конкретные решения.

Правила:
1. Отвечай ТОЛЬКО на русском языке
2. Давай конкретные, actionable решения
3. Если анализируешь логи — укажи точную причину проблемы
4. Предлагай одно главное решение и максимум 2 альтернативы
5. Формат ответа: JSON с полями action (что делать), reason (почему), config_changes (изменения конфига если нужны)

Пример ответа:
{
  "action": "Сменить SNI на vk.com и fingerprint на qq",
  "reason": "В логах обнаружены паттерны блокировки TLS по текущему SNI",
  "config_changes": {
    "serverName": "vk.com",
    "fingerprint": "qq"
  }
}`,

    judge: `Ты — Судья ИИ (Judge). Твоя задача — оценивать предложенные изменения конфигурации на безопасность и корректность.

Правила:
1. Отвечай ТОЛЬКО на русском языке
2. Проверяй: корректность JSON, логическую согласованность, потенциальные риски
3. Выноси вердикт: APPROVE или REJECT
4. При REJECT — объясни причину и предложи исправление
5. Формат ответа: JSON с полями verdict (APPROVE/REJECT), reason (обоснование), risk_level (low/medium/high)

Пример ответа:
{
  "verdict": "APPROVE",
  "reason": "Изменения корректны, JSON валиден, риски минимальны",
  "risk_level": "low"
}`
};

export default function IntegrationsPage() {
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    const [saveError, setSaveError] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [showDocs, setShowDocs] = useState(false);
    const [newIntName, setNewIntName] = useState("");
    const [copiedKey, setCopiedKey] = useState(null);
    const [selectedId, setSelectedId] = useState(null);

    const allModels = AI_MODELS.text.map(m => ({ id: m.id, name: m.name, provider: m.provider }));
    const selectedInt = integrations.find(i => i.id === selectedId) || null;

    useEffect(() => { fetchIntegrations(); }, []);

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
                allowedModels: []  // empty = user must pick models
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
                    // toggle "all": if already all, clear it; otherwise set to all
                    const isAll = (t.allowedModels || []).includes("all");
                    return { ...t, allowedModels: isAll ? [] : ["all"] };
                }
                // specific model: remove "all" flag, toggle model
                let current = (t.allowedModels || []).filter(m => m !== "all");
                if (current.includes(modelId)) {
                    current = current.filter(m => m !== modelId);
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

    // ── DOCS MODAL ───────────────────────────────────────────────────────────
    const DocsModal = () => (
        <div className={styles.modal} onClick={() => setShowDocs(false)}>
            <div className={styles.docsContent} onClick={e => e.stopPropagation()}>
                <div className={styles.docsHeader}>
                    <h2 style={{ margin: 0, fontSize: 18 }}>Документация API интеграций</h2>
                    <button className={styles.closeBtn} onClick={() => setShowDocs(false)}><X size={18} /></button>
                </div>
                <div className={styles.docsBody}>

                    <h3>Обзор</h3>
                    <p>API интеграций позволяет внешним приложениям (скриптам, ботам, сервисам) отправлять запросы к AI-моделям через ваш AI Hub, используя API-ключ и задачи с настроенными правами.</p>

                    <h3>Аутентификация</h3>
                    <p>Все запросы требуют Bearer-токен в заголовке:</p>
                    <div className={styles.codeBlock}>{`Authorization: Bearer sk-aihub-xxxxxxxxxxxxxxxx`}</div>

                    <h3>Эндпоинты</h3>

                    <div className={styles.endpointBlock}>
                        <span className={styles.methodPost}>POST</span>
                        <code>/api/integrations/chat</code>
                        <p>Отправить промпт к AI-модели через интеграцию.</p>
                        <strong>Тело запроса (JSON):</strong>
                        <div className={styles.codeBlock}>{`{
  "task": "worker",        // ID задачи (обязательно)
  "prompt": "Текст...",    // Промпт для модели (обязательно)
  "model": "llama-3.3-70b-versatile"  // ID модели (опционально)
}`}</div>
                        <strong>Успешный ответ:</strong>
                        <div className={styles.codeBlock}>{`{
  "status": "ok",
  "answer": "Ответ модели...",
  "model_used": "llama-3.3-70b-versatile"
}`}</div>
                        <strong>Ошибки:</strong>
                        <div className={styles.codeBlock}>{`401 - Неверный или отсутствующий API ключ
403 - Задача не настроена / модель не разрешена
400 - Отсутствуют обязательные параметры
500 - Внутренняя ошибка сервера`}</div>
                    </div>

                    <div className={styles.endpointBlock}>
                        <span className={styles.methodGet}>GET</span>
                        <code>/api/integrations</code>
                        <p>Получить список всех интеграций (только для внутреннего использования).</p>
                    </div>

                    <div className={styles.endpointBlock}>
                        <span className={styles.methodPost}>POST</span>
                        <code>/api/integrations</code>
                        <p>Сохранить список интеграций (только для внутреннего использования).</p>
                    </div>

                    <h3>Доступные модели</h3>
                    <div className={styles.codeBlock}>{allModels.map(m => `${m.id.padEnd(45)} (${m.provider})`).join('\n')}</div>

                    <h3>Системные промпты для ИИ-агентов</h3>
                    <p>Используйте эти промпты как <code>system</code>-сообщение при настройке агентов:</p>

                    <strong>Сотрудник (Worker) — анализ и предложение решений:</strong>
                    <div className={styles.codeBlock} style={{ position: 'relative' }}>
                        <button
                            className={styles.copyOverlay}
                            onClick={() => copyToClipboard(SYSTEM_PROMPTS.worker, 'prompt_worker')}
                        >
                            {copiedKey === 'prompt_worker' ? <Check size={14} color="#28a745" /> : <Copy size={14} />}
                        </button>
                        {SYSTEM_PROMPTS.worker}
                    </div>

                    <strong style={{ display: 'block', marginTop: 16 }}>Судья (Judge) — проверка и вердикт:</strong>
                    <div className={styles.codeBlock} style={{ position: 'relative' }}>
                        <button
                            className={styles.copyOverlay}
                            onClick={() => copyToClipboard(SYSTEM_PROMPTS.judge, 'prompt_judge')}
                        >
                            {copiedKey === 'prompt_judge' ? <Check size={14} color="#28a745" /> : <Copy size={14} />}
                        </button>
                        {SYSTEM_PROMPTS.judge}
                    </div>

                    <h3>Пример: Python-скрипт (ai_manager.py)</h3>
                    <div className={styles.codeBlock}>{`import requests

API_KEY = "sk-aihub-xxxxxxxxxxxxxxxx"
BASE_URL = "${SITE_URL}"

# Модели задаются отдельно для каждого агента.
# Укажи те модели, которые настроены в задачах твоей интеграции.
WORKER_MODELS = [
    "llama-3.3-70b-versatile",           # основная (быстрая, бесплатная)
    "meta-llama/llama-4-maverick-17b-128e-instruct",  # резервная 1
    "qwen/qwen3-32b",                     # резервная 2
]
JUDGE_MODEL = "anthropic/claude-3.5-sonnet"  # судья — точная платная модель


def ask_worker(log_data, model=None):
    """Отправить логи Сотруднику ИИ для анализа."""
    selected_model = model or WORKER_MODELS[0]
    res = requests.post(
        f"{BASE_URL}/api/integrations/chat",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={
            "task": "worker",
            "prompt": f"Проанализируй логи:\\n{log_data}",
            "model": selected_model
        }
    )
    res.raise_for_status()
    return res.json()["answer"]


def ask_judge(proposed_change, current_config, model=None):
    """Отправить предложенное изменение Судье ИИ для проверки."""
    selected_model = model or JUDGE_MODEL
    res = requests.post(
        f"{BASE_URL}/api/integrations/chat",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={
            "task": "judge",
            "prompt": f"Текущий конфиг:\\n{current_config}\\n\\nПредложенное изменение:\\n{proposed_change}",
            "model": selected_model
        }
    )
    res.raise_for_status()
    return res.json()["answer"]


# Использование — Worker с разными моделями
log_snippet = "ERROR: TLS handshake timeout..."

# Основная модель
worker_answer = ask_worker(log_snippet)
print("Worker (основная):", worker_answer)

# Или явно указать другую модель из разрешённых
worker_answer2 = ask_worker(log_snippet, model="qwen/qwen3-32b")
print("Worker (qwen):", worker_answer2)

# Судья всегда использует свою модель
judge_answer = ask_judge(worker_answer, open("/opt/xray/config.json").read())
print("Judge:", judge_answer)`}</div>

                </div>
            </div>
        </div>
    );

    // ── DETAIL VIEW ──────────────────────────────────────────────────────────
    if (selectedId && selectedInt) {
        return (
            <div className={styles.container}>
                {showDocs && <DocsModal />}
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
                        <button className={styles.docsBtn} onClick={() => setShowDocs(true)}>
                            <BookOpen size={15} /> Документация
                        </button>
                        <button className={styles.deleteBtnRed} onClick={() => deleteIntegration(selectedId)}>
                            <Trash2 size={15} /> Удалить
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
                        const selectedModels = (task.allowedModels || []).filter(m => m !== "all");
                        const hasNoModels = !isAll && selectedModels.length === 0;

                        return (
                            <div key={task.id} className={styles.taskItem}>
                                <div className={styles.taskHeader}>
                                    <span className={styles.taskName}>Задача: <code>{task.id}</code></span>
                                    <button className={styles.deleteBtn} onClick={() => deleteTask(task.id)}>Удалить</button>
                                </div>

                                <div style={{ marginTop: 10 }}>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                        Разрешённые модели:
                                        {isAll && <span style={{ marginLeft: 8, color: '#28a745', fontWeight: 500 }}>все</span>}
                                        {!isAll && selectedModels.length > 0 && (
                                            <span style={{ marginLeft: 8, color: 'var(--primary-color, #007bff)', fontWeight: 500 }}>
                                                выбрано {selectedModels.length}
                                            </span>
                                        )}
                                        {hasNoModels && (
                                            <span style={{ marginLeft: 8, color: '#dc3545', fontWeight: 500 }}>
                                                не выбрано ни одной
                                            </span>
                                        )}
                                    </div>

                                    {/* All models checkbox */}
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isAll}
                                            onChange={() => toggleTaskModel(task.id, "all")}
                                        />
                                        <span>Все модели (клиент выбирает сам)</span>
                                    </label>

                                    {/* Individual models — always visible, disabled when "all" is checked */}
                                    <div className={`${styles.modelCheckboxList} ${isAll ? styles.modelCheckboxListDisabled : ''}`}>
                                        {allModels.map(m => (
                                            <label key={m.id} className={`${styles.checkboxLabel} ${isAll ? styles.checkboxLabelDisabled : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedModels.includes(m.id)}
                                                    disabled={isAll}
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

                    {/* Per-task code examples */}
                    {selectedInt.tasks && selectedInt.tasks.length > 0 ? selectedInt.tasks.map(task => {
                        const isAll = (task.allowedModels || []).includes("all");
                        const taskModels = isAll
                            ? allModels.map(m => m.id)
                            : (task.allowedModels || []);
                        const firstModel = taskModels[0] || 'llama-3.3-70b-versatile';

                        return (
                            <div key={task.id} style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                                    Задача: <code style={{ color: 'var(--text-primary)' }}>{task.id}</code>
                                    {' · '}
                                    {isAll
                                        ? <span style={{ color: '#28a745' }}>все модели разрешены</span>
                                        : <span style={{ color: 'var(--primary-color, #007bff)' }}>
                                            разрешено: {taskModels.map(id => getModelName(id)).join(', ')}
                                          </span>
                                    }
                                </div>
                                <div className={styles.codeBlock}>
{`curl -X POST ${SITE_URL}/api/integrations/chat \\
  -H "Authorization: Bearer ${selectedInt.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "task": "${task.id}",
    "prompt": "Твой промпт",
    "model": "${firstModel}"${taskModels.length > 1 ? `  // также доступны: ${taskModels.slice(1).join(', ')}` : ''}
  }'`}
                                </div>
                            </div>
                        );
                    }) : (
                        <div className={styles.codeBlock}>
{`curl -X POST ${SITE_URL}/api/integrations/chat \\
  -H "Authorization: Bearer ${selectedInt.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "task": "worker",
    "prompt": "Твой промпт",
    "model": "llama-3.3-70b-versatile"
  }'`}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── LIST VIEW ────────────────────────────────────────────────────────────
    return (
        <div className={styles.container}>
            {showDocs && <DocsModal />}
            <div className={styles.header}>
                <h1 className={styles.title}>Интеграции (API)</h1>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className={styles.docsBtn} onClick={() => setShowDocs(true)}>
                        <BookOpen size={15} /> Документация
                    </button>
                    <button className={styles.createBtn} onClick={() => setShowModal(true)}>
                        <Plus size={17} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Создать интеграцию
                    </button>
                </div>
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
