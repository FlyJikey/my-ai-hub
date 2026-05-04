"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Check, ChevronRight, AlertCircle, BookOpen, X } from "lucide-react";
import styles from "./page.module.css";
import { AI_MODELS } from "@/config/models";
import { readJsonResponse } from "@/lib/api-response";
import {
    buildModelList,
    buildRequestBodyExample,
    buildResponseExample,
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

export default function IntegrationsPage() {
    const router = useRouter();
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    const [saveError, setSaveError] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [showDocs, setShowDocs] = useState(false);
    const [newIntName, setNewIntName] = useState("");
    const [copiedKey, setCopiedKey] = useState(null);

    const allModels = AI_MODELS.text.map(m => ({ id: m.id, name: m.name, provider: m.provider, tier: m.tier }));
    const exampleTask = { id: "worker", allowedModels: allModels[0]?.id ? [allModels[0].id] : [] };

    useEffect(() => { fetchIntegrations(); }, []);

    const fetchIntegrations = async () => {
        setLoading(true);
        setSaveStatus(null);
        setSaveError("");
        try {
            const res = await fetch("/api/integrations");
            const data = await readJsonResponse(res);
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
        setShowModal(false);
        setNewIntName("");
        router.push(`/dashboard/integrations/${newInt.id}`);
    };

    const copyToClipboard = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    if (loading) return <div className={styles.container}><p>Загрузка...</p></div>;

    const DocsModal = () => (
        <div className={styles.modal} onClick={() => setShowDocs(false)}>
            <div className={styles.docsContent} onClick={e => e.stopPropagation()}>
                <div className={styles.docsHeader}>
                    <h2 style={{ margin: 0, fontSize: 18 }}>Документация API интеграций</h2>
                    <button className={styles.closeBtn} onClick={() => setShowDocs(false)}><X size={18} /></button>
                </div>
                <div className={styles.docsBody}>
                    <h3>Обзор</h3>
                    <p>API интеграций позволяет внешним приложениям (скриптам, ботам, сервисам) отправлять запросы к AI-моделям через AI Hub, используя API-ключ и задачи с настроенными правами.</p>

                    <h3>Аутентификация</h3>
                    <p>Все запросы требуют Bearer-токен в заголовке:</p>
                    <div className={styles.codeBlock}>{`Authorization: Bearer sk-aihub-xxxxxxxxxxxxxxxx`}</div>

                    <h3>Эндпоинты</h3>
                    <div className={styles.endpointBlock}>
                        <span className={styles.methodPost}>POST</span>
                        <code>{SITE_URL}/api/integrations/chat</code>
                        <p>Отправить промпт к AI-модели через интеграцию.</p>
                        <strong>Тело запроса (JSON):</strong>
                        <div className={styles.codeBlock}>{buildRequestBodyExample(exampleTask, allModels)}</div>
                        <strong>Успешный ответ:</strong>
                        <div className={styles.codeBlock}>{buildResponseExample(exampleTask, allModels)}</div>
                        <strong>Ошибки:</strong>
                        <div className={styles.codeBlock}>{`401 - Неверный или отсутствующий API ключ
403 - Задача не настроена / модель не разрешена
400 - Отсутствуют обязательные параметры
500 - Внутренняя ошибка сервера`}</div>
                    </div>

                    <div className={styles.endpointBlock}>
                        <span className={styles.methodGet}>GET</span>
                        <code>{SITE_URL}/api/integrations</code>
                        <p>Получить список всех интеграций (только для внутреннего использования).</p>
                    </div>

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
                </div>
            </div>
        </div>
    );

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
                Создавайте API-ключи для внешних приложений. Endpoint: <code>{SITE_URL}/api/integrations/chat</code>
            </p>

            {integrations.length === 0 ? (
                <div className={styles.emptyState}>
                    Нет интеграций. Нажмите «Создать интеграцию».
                </div>
            ) : (
                <div className={styles.list}>
                    {integrations.map((int) => (
                        <div key={int.id} className={styles.listItem} onClick={() => router.push(`/dashboard/integrations/${int.id}`)}>
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
