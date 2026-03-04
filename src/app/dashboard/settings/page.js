"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Trash2, Edit2, CheckCircle, AlertCircle, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import styles from "./page.module.css";

export default function SettingsPage() {
    const [settings, setSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    const [editingScenario, setEditingScenario] = useState(null);
    const [editingModel, setEditingModel] = useState(null);

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
                        <h2 className={styles.cardTitle}>Сценарии (Промпты)</h2>
                        <button className={styles.addBtn} onClick={() => setEditingScenario({ name: "", icon: "📝", description: "", prompt: "" })}>
                            <Plus size={16} /> Создать сценарий
                        </button>
                    </div>

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
        </div>
    );
}
