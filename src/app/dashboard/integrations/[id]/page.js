"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2, Copy, Check, ArrowLeft, AlertCircle, BookOpen, X } from "lucide-react";
import styles from "../page.module.css";
import { AI_MODELS } from "@/config/models";
import { useAppContext } from "@/app/context/AppContext";
import { readJsonResponse } from "@/lib/api-response";
import { syncAllowedModelsWithAvailable } from "@/lib/model-settings";
import {
    buildAiSetupPrompt,
    buildModelList,
    buildRequestBodyExample,
    buildRequestExample,
    buildResponseExample,
    buildTaskModelSummary,
    getAllowedModelIds,
    getDefaultModelId,
    getModelLabel,
} from "@/lib/integration-docs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://my-ai-hub-silk.vercel.app";

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

export default function IntegrationDetailPage() {
    const { id } = useParams();
    const router = useRouter();

    const [integration, setIntegration] = useState(null);
    const [allIntegrations, setAllIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    const [saveError, setSaveError] = useState("");
    const [copiedKey, setCopiedKey] = useState(null);
    const [showDocs, setShowDocs] = useState(false);
    const { availableTextModels } = useAppContext();

    const modelSource = availableTextModels.length ? availableTextModels : AI_MODELS.text;
    const allModels = modelSource.map(m => ({ id: m.id, name: m.name, provider: m.provider, tier: m.tier }));

    useEffect(() => { fetchData(); }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/integrations");
            const data = await readJsonResponse(res);
            if (data.integrations) {
                setAllIntegrations(data.integrations);
                const found = data.integrations.find(i => i.id === id);
                if (found) {
                    setIntegration(found);
                } else {
                    router.push("/dashboard/integrations");
                }
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
        setAllIntegrations(updatedList);
        const updated = updatedList.find(i => i.id === id);
        if (updated) setIntegration(updated);
        setSaving(true);
        setSaveStatus(null);
        setSaveError("");
        try {
            const res = await fetch("/api/integrations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ integrations: updatedList })
            });
            const data = await readJsonResponse(res);
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

    const deleteIntegration = () => {
        if (!confirm("Точно удалить эту интеграцию?")) return;
        persistIntegrations(allIntegrations.filter(i => i.id !== id));
        router.push("/dashboard/integrations");
    };

    const addTask = () => {
        const taskName = prompt("Введите ID задачи (например: worker или judge):");
        if (!taskName) return;
        const newTask = {
            id: taskName.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
            name: taskName,
            allowedModels: []
        };
        const newList = allIntegrations.map(i =>
            i.id === id ? { ...i, tasks: [...(i.tasks || []), newTask] } : i
        );
        persistIntegrations(newList);
    };

    const deleteTask = (taskId) => {
        const newList = allIntegrations.map(i =>
            i.id === id ? { ...i, tasks: i.tasks.filter(t => t.id !== taskId) } : i
        );
        persistIntegrations(newList);
    };

    const toggleTaskModel = (taskId, modelId) => {
        const newList = allIntegrations.map(int => {
            if (int.id !== id) return int;
            const newTasks = int.tasks.map(t => {
                if (t.id !== taskId) return t;
                if (modelId === "all") {
                    const isAll = (t.allowedModels || []).includes("all");
                    return { ...t, allowedModels: isAll ? [] : ["all"] };
                }
                let current = syncAllowedModelsWithAvailable(t.allowedModels, allModels);
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
        return getModelLabel(modelId, allModels);
    };

    const aiSetupPrompt = buildAiSetupPrompt({
        siteUrl: SITE_URL,
        apiKey: integration?.apiKey || "",
        integration,
        models: allModels,
    });

    if (loading) return <div className={styles.container}><p>Загрузка...</p></div>;
    if (!integration) return null;

    const DocsModal = () => (
        <div className={styles.modal} onClick={() => setShowDocs(false)}>
            <div className={styles.docsContent} onClick={e => e.stopPropagation()}>
                <div className={styles.docsHeader}>
                    <h2 style={{ margin: 0, fontSize: 18 }}>Документация API интеграций</h2>
                    <div className={styles.docsHeaderActions}>
                        <button
                            className={styles.promptCopyBtn}
                            onClick={() => copyToClipboard(aiSetupPrompt, 'aiSetupPrompt')}
                        >
                            {copiedKey === 'aiSetupPrompt' ? <Check size={15} /> : <Copy size={15} />}
                            Промпт для ИИ
                        </button>
                        <button className={styles.closeBtn} onClick={() => setShowDocs(false)}><X size={18} /></button>
                    </div>
                </div>
                <div className={styles.docsBody}>
                    <h3>Обзор</h3>
                    <p>API интеграций позволяет внешним приложениям отправлять запросы к AI-моделям через AI Hub, используя API-ключ и задачи с настроенными правами.</p>

                    <h3>Автонастройка через ИИ</h3>
                    <p>Скопируйте этот промпт в ИИ-агента, который будет настраивать внешнее приложение. Промпт собран из текущего endpoint, API-ключа, задач и выбранных моделей этой интеграции.</p>
                    <div className={styles.codeBlock} style={{ position: 'relative' }}>
                        <button className={styles.copyOverlay} onClick={() => copyToClipboard(aiSetupPrompt, 'aiSetupPromptBlock')}>
                            {copiedKey === 'aiSetupPromptBlock' ? <Check size={14} color="#28a745" /> : <Copy size={14} />}
                        </button>
                        {aiSetupPrompt}
                    </div>

                    <h3>Аутентификация</h3>
                    <p>Все запросы требуют Bearer-токен в заголовке:</p>
                    <div className={styles.codeBlock}>{`Authorization: Bearer ${integration.apiKey}`}</div>

                    <h3>Эндпоинты</h3>
                    <div className={styles.endpointBlock}>
                        <span className={styles.methodPost}>POST</span>
                        <code>{SITE_URL}/api/integrations/chat</code>
                        <p>Отправить промпт к AI-модели через интеграцию.</p>
                        <strong>Тело запроса (JSON):</strong>
                        <div className={styles.codeBlock}>{buildRequestBodyExample(integration.tasks?.[0] || { id: "worker", allowedModels: [] }, allModels)}</div>
                        <strong>Успешный ответ:</strong>
                        <div className={styles.codeBlock}>{buildResponseExample(integration.tasks?.[0] || { id: "worker", allowedModels: [] }, allModels)}</div>
                        <strong>Ошибки:</strong>
                        <div className={styles.codeBlock}>{`401 - Неверный или отсутствующий API ключ
403 - Задача не настроена / модель не разрешена
400 - Отсутствуют обязательные параметры
500 - Внутренняя ошибка сервера`}</div>
                    </div>

                    <h3>Задачи этой интеграции</h3>
                    {(!integration.tasks || integration.tasks.length === 0) ? (
                        <p>Нет настроенных задач.</p>
                    ) : integration.tasks.map(task => (
                            <div key={task.id} className={styles.endpointBlock}>
                                <strong>Задача: <code>{task.id}</code></strong>
                                <p>Разрешённые модели: {buildTaskModelSummary(task, allModels)}</p>
                                <div className={styles.codeBlock}>{buildRequestBodyExample(task, allModels)}</div>
                            </div>
                    ))}

                    <h3>Доступные модели</h3>
                    <p>Список строится из текущей конфигурации текстовых моделей приложения.</p>
                    <div className={styles.codeBlock}>{buildModelList(allModels)}</div>

                    <h3>Системные промпты</h3>
                    <strong>Worker — анализ и решения:</strong>
                    <div className={styles.codeBlock} style={{ position: 'relative' }}>
                        <button className={styles.copyOverlay} onClick={() => copyToClipboard(SYSTEM_PROMPTS.worker, 'pw')}>
                            {copiedKey === 'pw' ? <Check size={14} color="#28a745" /> : <Copy size={14} />}
                        </button>
                        {SYSTEM_PROMPTS.worker}
                    </div>
                    <strong style={{ display: 'block', marginTop: 16 }}>Judge — проверка и вердикт:</strong>
                    <div className={styles.codeBlock} style={{ position: 'relative' }}>
                        <button className={styles.copyOverlay} onClick={() => copyToClipboard(SYSTEM_PROMPTS.judge, 'pj')}>
                            {copiedKey === 'pj' ? <Check size={14} color="#28a745" /> : <Copy size={14} />}
                        </button>
                        {SYSTEM_PROMPTS.judge}
                    </div>

                    <h3>Python-пример (ai_manager.py)</h3>
                    <div className={styles.codeBlock}>{`import requests

API_KEY = "${integration.apiKey}"
BASE_URL = "${SITE_URL}"
${integration.tasks?.map(task => {
    const models = getAllowedModelIds(task, allModels);
    const defaultModel = getDefaultModelId(task, allModels);
    if (!defaultModel) {
        return `
# Задача: ${task.id}
# Для этой задачи не выбраны модели. Добавьте модель в настройках интеграции.`;
    }
    return `
# Задача: ${task.id}
${task.id.toUpperCase()}_MODELS = [${models.slice(0, 3).map(m => `"${m}"`).join(', ')}]

def ask_${task.id}(prompt, model=None):
    res = requests.post(
        f"{BASE_URL}/api/integrations/chat",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={"task": "${task.id}", "prompt": prompt, "model": model or ${task.id.toUpperCase()}_MODELS[0]}
    )
    res.raise_for_status()
    return res.json()["answer"]`;
}).join('\n') || ''}
`}</div>
                </div>
            </div>
        </div>
    );

    return (
        <div className={styles.container}>
            {showDocs && <DocsModal />}

            <div className={styles.header}>
                <button className={styles.backBtn} onClick={() => router.push("/dashboard/integrations")}>
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
                    <button className={styles.deleteBtnRed} onClick={deleteIntegration}>
                        <Trash2 size={15} /> Удалить
                    </button>
                </div>
            </div>

            {saveStatus === "error" && (
                <div className={styles.errorBanner}>
                    <AlertCircle size={15} /> {saveError}
                </div>
            )}

            <h2 className={styles.detailTitle}>{integration.name}</h2>

            {/* API Key */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>API Ключ</div>
                <div className={styles.apiKeyContainer}>
                    <span className={styles.apiKeyText}>{integration.apiKey}</span>
                    <button className={styles.copyBtn} onClick={() => copyToClipboard(integration.apiKey, 'key')}>
                        {copiedKey === 'key' ? <Check size={16} color="#28a745" /> : <Copy size={16} />}
                    </button>
                </div>
            </div>

            {/* Tasks */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Задачи</div>
                {(!integration.tasks || integration.tasks.length === 0) ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 12px' }}>
                        Нет задач. Добавьте задачу чтобы разрешить API запросы.
                    </p>
                ) : integration.tasks.map((task) => {
                    const isAll = (task.allowedModels || []).includes("all");
                    const selectedModels = syncAllowedModelsWithAvailable(task.allowedModels, allModels);
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

                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={isAll}
                                        onChange={() => toggleTaskModel(task.id, "all")}
                                    />
                                    <span>Все модели (клиент выбирает сам)</span>
                                </label>

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

            {/* Usage examples */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Пример запроса</div>
                {integration.tasks && integration.tasks.length > 0 ? integration.tasks.map(task => {
                    const isAll = (task.allowedModels || []).includes("all");
                    const taskModels = getAllowedModelIds(task, allModels);
                    return (
                        <div key={task.id} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                                Задача: <code style={{ color: 'var(--text-primary)' }}>{task.id}</code>
                                {' · '}
                                {isAll
                                    ? <span style={{ color: '#28a745' }}>все модели разрешены</span>
                                    : <span style={{ color: 'var(--primary-color, #007bff)' }}>
                                        разрешено: {taskModels.map(id => getModelName(id)).join(', ') || 'не выбрано'}
                                      </span>
                                }
                            </div>
                            <div className={styles.codeBlock}>
{buildRequestExample({ siteUrl: SITE_URL, apiKey: integration.apiKey, task, models: allModels })}
                            </div>
                        </div>
                    );
                }) : (
                    <div className={styles.codeBlock}>
{`curl -X POST ${SITE_URL}/api/integrations/chat \\
  -H "Authorization: Bearer ${integration.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "task": "worker",
    "prompt": "Твой промпт"
  }'`}
                    </div>
                )}
            </div>
        </div>
    );
}
