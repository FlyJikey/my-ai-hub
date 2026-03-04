"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Trash2, Edit2, CheckCircle, AlertCircle, RefreshCw, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import styles from "./page.module.css";

export default function SettingsPage() {
    const [settings, setSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    const [editingScenario, setEditingScenario] = useState(null);
    const [editingModel, setEditingModel] = useState(null);
    const [editingBehavior, setEditingBehavior] = useState(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (res.ok) {
                setSettings(data);
            } else {
                setMessage({ text: "Ошибка загрузки настроек: " + data.error, type: "error" });
            }
        } catch (err) {
            setMessage({ text: "Ошибка подключения к API.", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage({ text: "", type: "" });
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: "Настройки успешно сохранены!", type: "success" });
                setTimeout(() => setMessage({ text: "", type: "" }), 3000);
            } else {
                setMessage({ text: "Ошибка сохранения: " + data.error, type: "error" });
            }
        } catch (err) {
            setMessage({ text: "Ошибка сети при сохранении.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const restoreScenarios = async () => {
        if (!confirm("Внимание! Это удалит все ваши текущие сценарии и вернет 6 стандартных шаблонов. Вы уверены?")) return;

        setIsSaving(true);
        setMessage({ text: "", type: "" });
        try {
            const res = await fetch('/api/settings?action=restore_scenarios', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setSettings(prev => ({ ...prev, scenarios: data.data.scenarios }));
                setMessage({ text: "Сценарии успешно сброшены к стандартным!", type: "success" });
                setTimeout(() => setMessage({ text: "", type: "" }), 3000);
            } else {
                setMessage({ text: "Ошибка сброса: " + data.error, type: "error" });
            }
        } catch (err) {
            setMessage({ text: "Ошибка сети при сбросе.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const restoreBehaviors = async () => {
        if (!confirm("Внимание! Это удалит все ваши текущие пресеты поведения ИИ и вернет один стандартный заводской пресет. Вы уверены?")) return;

        setIsSaving(true);
        setMessage({ text: "", type: "" });
        try {
            const res = await fetch('/api/settings?action=restore_behaviors', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setSettings(prev => ({ ...prev, behaviors: data.data.behaviors }));
                setMessage({ text: "Поведение ИИ успешно сброшено к эталону!", type: "success" });
                setTimeout(() => setMessage({ text: "", type: "" }), 3000);
            } else {
                setMessage({ text: "Ошибка сброса: " + data.error, type: "error" });
            }
        } catch (err) {
            setMessage({ text: "Ошибка сети при сбросе.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const toggleModel = (type, id) => {
        setSettings(prev => ({
            ...prev,
            [type]: prev[type].map(m => m.id === id ? { ...m, enabled: !m.enabled } : m)
        }));
    };

    const toggleScenario = (id) => {
        setSettings(prev => ({
            ...prev,
            scenarios: prev.scenarios.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
        }));
    };

    const deleteScenario = (id) => {
        if (!confirm("Вы уверены, что хотите удалить этот сценарий?")) return;
        setSettings(prev => ({
            ...prev,
            scenarios: prev.scenarios.filter(s => s.id !== id)
        }));
    };

    const saveScenario = (scenario) => {
        if (!scenario.id) {
            scenario.id = "sc_" + Date.now();
            scenario.enabled = true;
            setSettings(prev => ({ ...prev, scenarios: [...prev.scenarios, scenario] }));
        } else {
            setSettings(prev => ({
                ...prev,
                scenarios: prev.scenarios.map(s => s.id === scenario.id ? scenario : s)
            }));
        }
        setEditingScenario(null);
    };

    const setActiveBehavior = (id) => {
        setSettings(prev => ({
            ...prev,
            behaviors: prev.behaviors.map(b => ({ ...b, isActive: b.id === id }))
        }));
    };

    const deleteBehavior = (id) => {
        if (!confirm("Вы уверены, что хотите удалить этот пресет поведения?")) return;
        setSettings(prev => {
            const newBehaviors = prev.behaviors.filter(b => b.id !== id);
            // Ensure at least one is active if possible
            if (newBehaviors.length > 0 && !newBehaviors.some(b => b.isActive)) {
                newBehaviors[0].isActive = true;
            }
            return { ...prev, behaviors: newBehaviors };
        });
    };

    const saveBehavior = (behavior) => {
        if (!behavior.id) {
            behavior.id = "bh_custom_" + Date.now();
            behavior.isActive = false; // By default don't activate automatically
            setSettings(prev => ({ ...prev, behaviors: [...prev.behaviors, behavior] }));
        } else {
            setSettings(prev => ({
                ...prev,
                behaviors: prev.behaviors.map(b => b.id === behavior.id ? behavior : b)
            }));
        }
        setEditingBehavior(null);
    };

    const deleteModel = (type, id) => {
        if (!confirm("Вы уверены, что хотите удалить эту модель?")) return;
        setSettings(prev => ({
            ...prev,
            [type]: prev[type].filter(m => m.id !== id)
        }));
    };

    const moveModel = (type, index, direction) => {
        setSettings(prev => {
            const arr = [...prev[type]];
            if (direction === 'up' && index > 0) {
                [arr[index], arr[index - 1]] = [arr[index - 1], arr[index]];
            } else if (direction === 'down' && index < arr.length - 1) {
                [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
            }
            return { ...prev, [type]: arr };
        });
    };

    const moveScenario = (index, direction) => {
        setSettings(prev => {
            const arr = [...prev.scenarios];
            if (direction === 'up' && index > 0) {
                [arr[index], arr[index - 1]] = [arr[index - 1], arr[index]];
            } else if (direction === 'down' && index < arr.length - 1) {
                [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
            }
            return { ...prev, scenarios: arr };
        });
    };

    const saveModel = (modelStr) => {
        const newModel = { ...modelStr };
        newModel.enabled = true;

        if (newModel.modelType === 'text') {
            setSettings(prev => ({ ...prev, textModels: [...prev.textModels, newModel] }));
        } else {
            setSettings(prev => ({ ...prev, visionModels: [...prev.visionModels, newModel] }));
        }
        setEditingModel(null);
    };

    if (isLoading) {
        return <div className={styles.loadingState}><RefreshCw className={styles.spin} /> Загрузка настроек...</div>;
    }

    if (!settings) {
        return <div className={styles.errorState}>Не удалось загрузить настройки.</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Настройки AI / Спартак</h1>
                    <p className={styles.subtitle}>Управляйте доступными нейросетями и сценариями. Изменения применятся здесь и на сайте Спартак.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={styles.saveBtn}
                >
                    {isSaving ? <RefreshCw className={styles.spin} size={18} /> : <Save size={18} />}
                    Сохранить настройки
                </button>
            </div>

            {message.text && (
                <div className={`${styles.alert} ${message.type === 'error' ? styles.alertError : styles.alertSuccess}`}>
                    {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    {message.text}
                </div>
            )}

            <div className={styles.grid}>
                {/* ТЕКСТОВЫЕ МОДЕЛИ */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Текстовые Нейросети</h2>
                        <button className={styles.addBtn} onClick={() => setEditingModel({ id: "", name: "", description: "", provider: "polza", tier: "premium", modelType: "text", isCustom: true })}>
                            <Plus size={16} /> Добавить
                        </button>
                    </div>
                    <div className={styles.list}>
                        {settings.textModels.map((model, index) => (
                            <div key={model.id} className={styles.listItem}>
                                <div className={styles.itemInfo}>
                                    <div className={styles.itemName}>
                                        {model.name}
                                        <span className={model.tier === 'free' ? styles.badgeFree : styles.badgePremium}>
                                            {model.tier === 'free' ? 'БЕСПЛАТНО' : 'PRO'}
                                        </span>
                                        {model.isCustom && <span className={styles.badgeCustom}>КАСТОМ</span>}
                                    </div>
                                    <div className={styles.itemDesc}>{model.description}</div>
                                </div>
                                <div className={styles.scenarioActions}>
                                    <button className={styles.iconBtn} onClick={() => moveModel('textModels', index, 'up')} disabled={index === 0} title="Вверх" style={{ opacity: index === 0 ? 0.3 : 1 }}>
                                        <ChevronUp size={16} />
                                    </button>
                                    <button className={styles.iconBtn} onClick={() => moveModel('textModels', index, 'down')} disabled={index === settings.textModels.length - 1} title="Вниз" style={{ opacity: index === settings.textModels.length - 1 ? 0.3 : 1 }}>
                                        <ChevronDown size={16} />
                                    </button>
                                    {model.isCustom && (
                                        <button className={styles.iconBtnTextDelete} onClick={() => deleteModel('textModels', model.id)} title="Удалить">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={model.enabled !== false}
                                            onChange={() => toggleModel('textModels', model.id)}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* МОДЕЛИ ДЛЯ ФОТО */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Нейросети для Фото</h2>
                        <button className={styles.addBtn} onClick={() => setEditingModel({ id: "", name: "", description: "", provider: "polza", tier: "premium", modelType: "vision", isCustom: true })}>
                            <Plus size={16} /> Добавить
                        </button>
                    </div>
                    <div className={styles.list}>
                        {settings.visionModels.map((model, index) => (
                            <div key={model.id} className={styles.listItem}>
                                <div className={styles.itemInfo}>
                                    <div className={styles.itemName}>
                                        {model.name}
                                        <span className={model.tier === 'free' ? styles.badgeFree : styles.badgePremium}>
                                            {model.tier === 'free' ? 'БЕСПЛАТНО' : 'PRO'}
                                        </span>
                                        {model.isCustom && <span className={styles.badgeCustom}>КАСТОМ</span>}
                                    </div>
                                    <div className={styles.itemDesc}>{model.description}</div>
                                </div>
                                <div className={styles.scenarioActions}>
                                    <button className={styles.iconBtn} onClick={() => moveModel('visionModels', index, 'up')} disabled={index === 0} title="Вверх" style={{ opacity: index === 0 ? 0.3 : 1 }}>
                                        <ChevronUp size={16} />
                                    </button>
                                    <button className={styles.iconBtn} onClick={() => moveModel('visionModels', index, 'down')} disabled={index === settings.visionModels.length - 1} title="Вниз" style={{ opacity: index === settings.visionModels.length - 1 ? 0.3 : 1 }}>
                                        <ChevronDown size={16} />
                                    </button>
                                    {model.isCustom && (
                                        <button className={styles.iconBtnTextDelete} onClick={() => deleteModel('visionModels', model.id)} title="Удалить">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={model.enabled !== false}
                                            onChange={() => toggleModel('visionModels', model.id)}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* СЦЕНАРИИ */}
                <div className={`${styles.card} ${styles.fullWidth}`}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Пресеты и Сценарии (Промпты)</h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className={styles.addBtn} onClick={restoreScenarios} style={{ background: '#3f3f46' }} title="Сбросить к заводским настройкам">
                                <RotateCcw size={16} /> Сбросить
                            </button>
                            <button className={styles.addBtn} onClick={() => setEditingScenario({ name: "", icon: "📝", description: "", prompt: "" })}>
                                <Plus size={16} /> Создать пресет
                            </button>
                        </div>
                    </div>
                    <p style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '16px' }}>
                        Создавайте различные пресеты (например: "Обувь", "Характеристики не нужны") и задавайте в промпте, какие параметры надо писать, а какие нет. Затем выбирайте их прямо при генерации на Спартаке!
                    </p>

                    <div className={styles.list}>
                        {settings.scenarios.map((scenario, index) => (
                            <div key={scenario.id} className={styles.scenarioItem}>
                                <div className={styles.scenarioInfo}>
                                    <div className={styles.itemName}>{scenario.icon} {scenario.name}</div>
                                    <div className={styles.itemDesc}>{scenario.description}</div>
                                </div>
                                <div className={styles.scenarioActions}>
                                    <button className={styles.iconBtn} onClick={() => moveScenario(index, 'up')} disabled={index === 0} title="Вверх" style={{ opacity: index === 0 ? 0.3 : 1 }}>
                                        <ChevronUp size={16} />
                                    </button>
                                    <button className={styles.iconBtn} onClick={() => moveScenario(index, 'down')} disabled={index === settings.scenarios.length - 1} title="Вниз" style={{ opacity: index === settings.scenarios.length - 1 ? 0.3 : 1 }}>
                                        <ChevronDown size={16} />
                                    </button>
                                    <button className={styles.iconBtn} onClick={() => setEditingScenario(scenario)} title="Редактировать">
                                        <Edit2 size={16} />
                                    </button>
                                    <button className={styles.iconBtnTextDelete} onClick={() => deleteScenario(scenario.id)} title="Удалить">
                                        <Trash2 size={16} />
                                    </button>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={scenario.enabled !== false}
                                            onChange={() => toggleScenario(scenario.id)}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>
                            </div>
                        ))}
                        {settings.scenarios.length === 0 && (
                            <div className={styles.emptyState}>Нет сценариев. Создайте первый!</div>
                        )}
                    </div>
                </div>

                {/* ПОВЕДЕНИЕ ИИ (СИСТЕМНЫЕ ИНСТРУКЦИИ) */}
                <div className={`${styles.card} ${styles.fullWidth}`}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Поведение ИИ (Системные инструкции)</h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className={styles.addBtn} onClick={restoreBehaviors} style={{ background: '#3f3f46' }} title="Сбросить к заводским настройкам (эталону)">
                                <RotateCcw size={16} /> Сбросить к эталону
                            </button>
                            <button className={styles.addBtn} onClick={() => setEditingBehavior({
                                name: "", icon: "🧠", description: "",
                                visionPrompt: settings.behaviors?.[0]?.visionPrompt || "",
                                systemPrompt: settings.behaviors?.[0]?.systemPrompt || ""
                            })}>
                                <Plus size={16} /> Создать поведение
                            </button>
                        </div>
                    </div>
                    <p style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '16px' }}>
                        ВНИМАНИЕ: Здесь настраиваются жесткие базовые правила для ИИ. Меняйте аккуратно, чтобы не сломать JSON-формат для таблицы характеристик!
                    </p>

                    <div className={styles.list}>
                        {(settings.behaviors || []).map(behavior => (
                            <div key={behavior.id} className={styles.scenarioItem} style={{ borderLeft: behavior.isActive ? '4px solid #10b981' : 'none' }}>
                                <div className={styles.scenarioInfo}>
                                    <div className={styles.itemName}>
                                        {behavior.icon} {behavior.name}
                                        {behavior.isActive && <span style={{ fontSize: '10px', background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>АКТИВЕН</span>}
                                    </div>
                                    <div className={styles.itemDesc}>{behavior.description}</div>
                                </div>
                                <div className={styles.scenarioActions}>
                                    {!behavior.isActive && (
                                        <button className={styles.addBtn} onClick={() => setActiveBehavior(behavior.id)} style={{ padding: '4px 10px', fontSize: '12px' }}>
                                            Включить
                                        </button>
                                    )}
                                    <button className={styles.iconBtn} onClick={() => setEditingBehavior(behavior)} title="Редактировать инструкции">
                                        <Edit2 size={16} />
                                    </button>
                                    {behavior.id !== "bh_default_gold" && (
                                        <button className={styles.iconBtnTextDelete} onClick={() => deleteBehavior(behavior.id)} title="Удалить">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* МОДАЛКА РЕДАКТИРОВАНИЯ СЦЕНАРИЯ */}
            {editingScenario && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3 className={styles.modalTitle}>{editingScenario.id ? "Редактировать сценарий" : "Новый сценарий"}</h3>
                        <div className={styles.modalBody}>
                            <div className={styles.inputGroupRow}>
                                <div className={styles.inputGroup}>
                                    <label>Иконка (Эмодзи)</label>
                                    <input
                                        type="text"
                                        value={editingScenario.icon}
                                        onChange={e => setEditingScenario({ ...editingScenario, icon: e.target.value })}
                                        maxLength={5}
                                    />
                                </div>
                                <div className={styles.inputGroup} style={{ flex: 1 }}>
                                    <label>Название сценария</label>
                                    <input
                                        type="text"
                                        value={editingScenario.name}
                                        onChange={e => setEditingScenario({ ...editingScenario, name: e.target.value })}
                                        placeholder="Например: Супер продавец"
                                    />
                                </div>
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Краткое описание (для подсказки)</label>
                                <input
                                    type="text"
                                    value={editingScenario.description}
                                    onChange={e => setEditingScenario({ ...editingScenario, description: e.target.value })}
                                    placeholder="О чем этот сценарий..."
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Промпт (Инструкция для нейросети)</label>
                                <textarea
                                    value={editingScenario.prompt}
                                    onChange={e => setEditingScenario({ ...editingScenario, prompt: e.target.value })}
                                    placeholder="Опишите, как нейросеть должна генерировать ответ. ЗАПРЕЩАЙТЕ ИСПОЛЬЗОВАТЬ MARKDOWN символы для таблиц и заголовков."
                                    rows={10}
                                />
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setEditingScenario(null)}>Отмена</button>
                            <button
                                className={styles.saveModalBtn}
                                onClick={() => saveScenario(editingScenario)}
                                disabled={!editingScenario.name || !editingScenario.prompt}
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* МОДАЛКА ДОБАВЛЕНИЯ МОДЕЛИ */}
            {editingModel && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3 className={styles.modalTitle}>Добавить свою модель</h3>
                        <div className={styles.modalBody}>
                            <div className={styles.inputGroup}>
                                <label>ID Модели (из Polza.ai / OpenRouter / Groq)</label>
                                <input
                                    type="text"
                                    value={editingModel.id}
                                    onChange={e => setEditingModel({ ...editingModel, id: e.target.value })}
                                    placeholder="Например: openai/gpt-4o-mini"
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Название (для отображения)</label>
                                <input
                                    type="text"
                                    value={editingModel.name}
                                    onChange={e => setEditingModel({ ...editingModel, name: e.target.value })}
                                    placeholder="Например: Моя GPT-4o Mini"
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Краткое описание</label>
                                <input
                                    type="text"
                                    value={editingModel.description}
                                    onChange={e => setEditingModel({ ...editingModel, description: e.target.value })}
                                    placeholder="Описание модели..."
                                />
                            </div>
                            <div className={styles.inputGroupRow}>
                                <div className={styles.inputGroup} style={{ flex: 1 }}>
                                    <label>Провайдер</label>
                                    <select
                                        className={styles.selectInput}
                                        value={editingModel.provider}
                                        onChange={e => setEditingModel({ ...editingModel, provider: e.target.value })}
                                    >
                                        <option value="polza">Polza.ai</option>
                                        <option value="openrouter">OpenRouter</option>
                                        <option value="groq">Groq</option>
                                    </select>
                                </div>
                                <div className={styles.inputGroup} style={{ flex: 1 }}>
                                    <label>Тип модели</label>
                                    <select
                                        className={styles.selectInput}
                                        value={editingModel.modelType}
                                        onChange={e => setEditingModel({ ...editingModel, modelType: e.target.value })}
                                    >
                                        <option value="text">Текст (Text)</option>
                                        <option value="vision">Фото (Vision)</option>
                                    </select>
                                </div>
                                <div className={styles.inputGroup} style={{ flex: 1 }}>
                                    <label>Платность</label>
                                    <select
                                        className={styles.selectInput}
                                        value={editingModel.tier}
                                        onChange={e => setEditingModel({ ...editingModel, tier: e.target.value })}
                                    >
                                        <option value="premium">PRO (Платно)</option>
                                        <option value="free">БЕСПЛАТНО</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setEditingModel(null)}>Отмена</button>
                            <button
                                className={styles.saveModalBtn}
                                onClick={() => saveModel(editingModel)}
                                disabled={!editingModel.id || !editingModel.name}
                            >
                                Добавить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* МОДАЛКА РЕДАКТИРОВАНИЯ ПОВЕДЕНИЯ ИИ */}
            {editingBehavior && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal} style={{ maxWidth: '800px', width: '95%' }}>
                        <h3 className={styles.modalTitle}>{editingBehavior.id ? "Редактировать системное поведение" : "Новое системное поведение"}</h3>
                        <div className={styles.modalBody}>
                            <div className={styles.inputGroupRow}>
                                <div className={styles.inputGroup}>
                                    <label>Эмодзи</label>
                                    <input
                                        type="text"
                                        value={editingBehavior.icon}
                                        onChange={e => setEditingBehavior({ ...editingBehavior, icon: e.target.value })}
                                        maxLength={5}
                                    />
                                </div>
                                <div className={styles.inputGroup} style={{ flex: 1 }}>
                                    <label>Название (для вас)</label>
                                    <input
                                        type="text"
                                        value={editingBehavior.name}
                                        onChange={e => setEditingBehavior({ ...editingBehavior, name: e.target.value })}
                                        placeholder="Например: ИИ (Без материалов)"
                                    />
                                </div>
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Краткое описание (что делает этот ИИ)</label>
                                <input
                                    type="text"
                                    value={editingBehavior.description}
                                    onChange={e => setEditingBehavior({ ...editingBehavior, description: e.target.value })}
                                    placeholder="Инструкция без указания материалов..."
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label style={{ color: '#ef4444' }}>Системный Промпт для Vision (ВАЖНО: Должен возвращать JSON таблицы характеристик!)</label>
                                <textarea
                                    value={editingBehavior.visionPrompt}
                                    onChange={e => setEditingBehavior({ ...editingBehavior, visionPrompt: e.target.value })}
                                    className={styles.textareaInput}
                                    placeholder="СТРОГОЕ ПРАВИЛО:..."
                                    rows={8}
                                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Системная Роль для Text 모델 (Основа копирайтера)</label>
                                <textarea
                                    value={editingBehavior.systemPrompt}
                                    onChange={e => setEditingBehavior({ ...editingBehavior, systemPrompt: e.target.value })}
                                    className={styles.textareaInput}
                                    placeholder="You are a professional SEO copywriter..."
                                    rows={3}
                                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                                />
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setEditingBehavior(null)}>Отмена</button>
                            <button
                                className={styles.saveModalBtn}
                                onClick={() => saveBehavior(editingBehavior)}
                                disabled={!editingBehavior.name || !editingBehavior.visionPrompt || !editingBehavior.systemPrompt}
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
