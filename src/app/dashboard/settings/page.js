"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Trash2, Edit2, CheckCircle, AlertCircle, RefreshCw, ChevronUp, ChevronDown, RotateCcw, FileText } from "lucide-react";
import styles from "./page.module.css";

export default function SettingsPage() {
    const [settings, setSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    const [editingScenario, setEditingScenario] = useState(null);
    const [editingModel, setEditingModel] = useState(null);
    const [editingBehavior, setEditingBehavior] = useState(null);

    const [activeTab, setActiveTab] = useState('models'); // 'models' or 'limits' or 'logs' or 'polza' or 'omniroute'
    const [limitsData, setLimitsData] = useState(null);
    const [isLoadingLimits, setIsLoadingLimits] = useState(false);
    const [logsData, setLogsData] = useState([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    const [polzaBalance, setPolzaBalance] = useState(null);
    const [polzaModels, setPolzaModels] = useState([]);
    const [isLoadingPolza, setIsLoadingPolza] = useState(false);
    const [polzaSearch, setPolzaSearch] = useState("");
    const [selectedProvider, setSelectedProvider] = useState("all");

    const [omnirouteModels, setOmnirouteModels] = useState([]);
    const [isLoadingOmniroute, setIsLoadingOmniroute] = useState(false);
    const [omnirouteSearch, setOmnirouteSearch] = useState("");
    const [selectedOmnirouteProvider, setSelectedOmnirouteProvider] = useState("all");

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

    const fetchLimits = async () => {
        setIsLoadingLimits(true);
        try {
            const res = await fetch('/api/limits');
            const data = await res.json();
            if (res.ok) {
                setLimitsData(data.providers);
            } else {
                setMessage({ text: "Ошибка загрузки лимитов: " + data.error, type: "error" });
            }
        } catch (err) {
            setMessage({ text: "Ошибка получения лимитов.", type: "error" });
        } finally {
            setIsLoadingLimits(false);
        }
    };

    const fetchLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const res = await fetch('/api/logs');
            const data = await res.json();
            if (res.ok) {
                setLogsData(data.logs || []);
            } else {
                setMessage({ text: "Ошибка загрузки логов: " + data.error, type: "error" });
            }
        } catch (err) {
            setMessage({ text: "Ошибка получения логов.", type: "error" });
        } finally {
            setIsLoadingLogs(false);
        }
    };

    const clearLogs = async () => {
        if (!confirm("Вы уверены, что хотите удалить все логи?")) return;
        try {
            await fetch('/api/logs', { method: 'DELETE' });
            setLogsData([]);
            setMessage({ text: "Логи успешно очищены.", type: "success" });
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
        } catch (e) { }
    };

    const fetchPolzaData = async () => {
        setIsLoadingPolza(true);
        try {
            const [bRes, mRes] = await Promise.all([
                fetch('/api/polza/balance'),
                fetch('/api/polza/models')
            ]);
            
            if (bRes.ok) {
                const bData = await bRes.json();
                setPolzaBalance(bData.amount);
            }
            
            if (mRes.ok) {
                const mData = await mRes.json();
                setPolzaModels(mData.data || mData.models || []);
            }
        } catch (err) {
            console.error("Error fetching Polza data:", err);
        } finally {
            setIsLoadingPolza(false);
        }
    };

    const fetchOmnirouteData = async () => {
        setIsLoadingOmniroute(true);
        try {
            const mRes = await fetch('/api/omniroute/models');
            
            if (mRes.ok) {
                const mData = await mRes.json();
                setOmnirouteModels(mData.data || []);
            }
        } catch (err) {
            console.error("Error fetching OmniRoute data:", err);
        } finally {
            setIsLoadingOmniroute(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'limits' && !limitsData) {
            fetchLimits();
        }
        if (activeTab === 'logs' && logsData.length === 0) {
            fetchLogs();
        }
        if (activeTab === 'polza' && polzaModels.length === 0) {
            fetchPolzaData();
        }
        if (activeTab === 'omniroute' && omnirouteModels.length === 0) {
            fetchOmnirouteData();
        }
    }, [activeTab]);

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

    const saveModel = (model) => {
        const isVision = model.modelType === 'vision';
        setSettings(prev => {
            // Remove existing by ID from both lists
            const filteredText = prev.textModels.filter(m => m.id !== model.id);
            const filteredVision = prev.visionModels.filter(m => m.id !== model.id);
            
            if (isVision) {
                return {
                    ...prev,
                    textModels: filteredText,
                    visionModels: [...filteredVision, { ...model, enabled: model.enabled ?? true }]
                };
            } else {
                return {
                    ...prev,
                    textModels: [...filteredText, { ...model, enabled: model.enabled ?? true }],
                    visionModels: filteredVision
                };
            }
        });
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
                    <p className={styles.subtitle}>Управляйте доступными нейросетями, сценариями и проверяйте лимиты API.</p>
                </div>
                {activeTab === 'models' && (
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={styles.saveBtn}
                    >
                        {isSaving ? <RefreshCw className={styles.spin} size={18} /> : <Save size={18} />}
                        Сохранить настройки
                    </button>
                )}
            </div>

            <div className={styles.tabsContainer}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'models' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('models')}
                >
                    Модели и Промпты
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'limits' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('limits')}
                >
                    Лимиты и API
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'logs' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('logs')}
                >
                    <FileText size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} /> Логи Ошибок
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'polza' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('polza')}
                >
                    🚀 Polza.ai
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'omniroute' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('omniroute')}
                >
                    🌐 OmniRoute
                </button>
            </div>

            {message.text && (
                <div className={`${styles.alert} ${message.type === 'error' ? styles.alertError : styles.alertSuccess}`}>
                    {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    {message.text}
                </div>
            )}

            {/* TAB: MODELS & PROMPTS */}
            {activeTab === 'models' && (
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
                                            <button className={styles.iconBtn} onClick={() => setEditingModel({ ...model, modelType: "text" })} title="Редактировать">
                                                <Edit2 size={16} />
                                            </button>
                                            <button className={styles.iconBtnTextDelete} onClick={() => deleteModel('textModels', model.id)} title="Удалить">
                                                <Trash2 size={16} />
                                            </button>
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
                                            <button className={styles.iconBtn} onClick={() => setEditingModel({ ...model, modelType: "vision" })} title="Редактировать">
                                                <Edit2 size={16} />
                                            </button>
                                            <button className={styles.iconBtnTextDelete} onClick={() => deleteModel('visionModels', model.id)} title="Удалить">
                                                <Trash2 size={16} />
                                            </button>
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
                            Создавайте различные пресеты (например: &quot;Обувь&quot;, &quot;Характеристики не нужны&quot;) и задавайте в промпте, какие параметры надо писать, а какие нет. Затем выбирайте их прямо при генерации на Спартаке!
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
                                    systemPrompt: settings.behaviors?.[0]?.systemPrompt || "",
                                    temperature: settings.behaviors?.[0]?.temperature || 0.5,
                                    top_p: settings.behaviors?.[0]?.top_p || 0.9,
                                    top_k: settings.behaviors?.[0]?.top_k || 40,
                                    repetition_penalty: settings.behaviors?.[0]?.repetition_penalty || 1.15,
                                    max_tokens: settings.behaviors?.[0]?.max_tokens || 2000
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
            )}

            {/* TAB: LIMITS */}
            {activeTab === 'limits' && (
                <div className={styles.limitsTab}>
                    {isLoadingLimits ? (
                        <div className={styles.loadingState} style={{ minHeight: '200px' }}><RefreshCw className={styles.spin} /> Загрузка лимитов...</div>
                    ) : limitsData ? (
                        <div className={styles.grid}>
                            {/* Polza.ai Limits */}
                            <div className={`${styles.card} ${styles.limitCard}`}>
                                <h3 className={styles.cardTitle}>Polza.ai (Российские API)</h3>
                                <div className={styles.limitStatusWrapper}>
                                    <div className={styles.limitStatusLabel}>Баланс:</div>
                                    <div className={`${styles.limitStatusValue} ${limitsData.polza?.status === 'active' ? styles.statusActive : styles.statusError}`}>
                                        {limitsData.polza?.balance || 'Проверка...'}
                                    </div>
                                </div>
                                <p className={styles.limitHint}>
                                    {limitsData.polza?.status === 'active'
                                        ? 'Polza.ai используется для рублевых оплат GPT-4o, Gemini и DeepSeek.'
                                        : 'Ключ Polza.ai не настроен или содержит ошибку.'}
                                </p>
                            </div>

                            {/* OpenRouter Limits */}
                            <div className={`${styles.card} ${styles.limitCard}`}>
                                <h3 className={styles.cardTitle}>OpenRouter (Зарубежные API)</h3>
                                <div className={styles.limitStatusWrapper}>
                                    <div className={styles.limitStatusLabel}>Баланс:</div>
                                    <div className={`${styles.limitStatusValue} ${limitsData.openrouter?.status === 'active' ? styles.statusActive : styles.statusError}`}>
                                        {limitsData.openrouter?.balance !== 'Активен' ? limitsData.openrouter?.balance : 'Доступно'}
                                    </div>
                                </div>
                                {limitsData.openrouter?.status === 'active' && (
                                    <div className={styles.limitStatusWrapper} style={{ marginTop: '-8px' }}>
                                        <div className={styles.limitStatusLabel}>Бесплатные модели:</div>
                                        <div className={styles.limitStatusValue} style={{ fontSize: '15px' }}>
                                            ~20 запросов / мин (200 / день)
                                        </div>
                                    </div>
                                )}
                                <p className={styles.limitHint}>
                                    {limitsData.openrouter?.status === 'active'
                                        ? 'Лимиты на бесплатные модели зависят от загруженности сети OpenRouter.'
                                        : 'Ключ OpenRouter не настроен. Бесплатные модели могут не работать.'}
                                </p>
                            </div>

                            {/* Groq Limits */}
                            <div className={`${styles.card} ${styles.limitCard}`}>
                                <h3 className={styles.cardTitle}>Groq (Сверхбыстрые API)</h3>
                                <div className={styles.limitStatusWrapper}>
                                    <div className={styles.limitStatusLabel}>Статус:</div>
                                    <div className={`${styles.limitStatusValue} ${limitsData.groq?.status === 'active' ? styles.statusActive : styles.statusError}`}>
                                        {limitsData.groq?.status === 'active' ? 'Работает' : limitsData.groq?.balance}
                                    </div>
                                </div>
                                {limitsData.groq?.status === 'active' && (
                                    <div className={styles.limitStatusWrapper} style={{ marginTop: '-8px' }}>
                                        <div className={styles.limitStatusLabel}>Лимит запросов:</div>
                                        <div className={styles.limitStatusValue} style={{ fontSize: '15px' }}>
                                            ~30 запросов / мин (14400 / день)
                                        </div>
                                    </div>
                                )}
                                <p className={styles.limitHint}>
                                    {limitsData.groq?.status === 'active'
                                        ? 'Groq обеспечивает самую быструю генерацию текста (Llama 3/Qwen) бесплатно.'
                                        : 'Ключ Groq не настроен.'}
                                </p>
                            </div>

                            {/* OmniRoute Limits */}
                            <div className={`${styles.card} ${styles.limitCard}`}>
                                <h3 className={styles.cardTitle}>OmniRoute (AI Gateway)</h3>
                                <div className={styles.limitStatusWrapper}>
                                    <div className={styles.limitStatusLabel}>Статус:</div>
                                    <div className={`${styles.limitStatusValue} ${limitsData.omniroute?.status === 'active' ? styles.statusActive : styles.statusError}`}>
                                        {limitsData.omniroute?.status === 'active' ? limitsData.omniroute?.balance : 'Не настроен'}
                                    </div>
                                </div>
                                <p className={styles.limitHint}>
                                    {limitsData.omniroute?.status === 'active'
                                        ? 'OmniRoute предоставляет доступ к множеству AI моделей через единый API.'
                                        : 'Ключ OmniRoute не настроен.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.errorState}>Ошбика загрузки лимитов.</div>
                    )}
                </div>
            )}

            {/* TAB: LOGS */}
            {activeTab === 'logs' && (
                <div className={styles.limitsTab}>
                    <div className={styles.header} style={{ marginBottom: '1.5rem', background: 'transparent' }}>
                        <div>
                            <h2 className={styles.cardTitle}>Журнал системных ошибок ИИ</h2>
                            <p className={styles.limitHint} style={{ marginTop: '0.25rem' }}>Здесь хранится до 100 последних ошибок генерации API. Подробности внутри каждого лога.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className={styles.addBtn} onClick={fetchLogs}>
                                <RefreshCw size={16} /> Обновить
                            </button>
                            <button className={styles.addBtn} style={{ background: '#ef4444' }} onClick={clearLogs}>
                                <Trash2 size={16} /> Очистить
                            </button>
                        </div>
                    </div>

                    {isLoadingLogs ? (
                        <div className={styles.loadingState} style={{ minHeight: '200px' }}><RefreshCw className={styles.spin} /> Загрузка логов...</div>
                    ) : logsData.length === 0 ? (
                        <div className={styles.emptyState}>
                            <CheckCircle size={48} color="#22c55e" opacity={0.5} style={{ marginBottom: '1rem' }} />
                            Ошибок пока нет. Все генерации проходят без системных сбоев!
                        </div>
                    ) : (
                        <div className={styles.grid} style={{ gridTemplateColumns: '1fr' }}>
                            {logsData.map(log => (
                                <div key={log.id} className={styles.card} style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '0.85rem', padding: '0.25rem 0.5rem', background: log.type === 'vision' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: log.type === 'vision' ? '#c084fc' : '#60a5fa', borderRadius: '0.5rem' }}>
                                                {log.type === 'vision' ? 'ФОТО (VISION)' : 'ТЕКСТ (TEXT)'}
                                            </span>
                                            <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}><b>Провайдер:</b> {log.provider}</span>
                                            <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}><b>Модель:</b> {log.model}</span>
                                        </div>
                                        <div style={{ color: '#6b7280', fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
                                            {new Date(log.timestamp).toLocaleString('ru-RU')}
                                        </div>
                                    </div>

                                    <h3 style={{ color: '#f87171', marginBottom: '1.25rem', fontSize: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                        <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <span>{log.message}</span>
                                    </h3>

                                    {log.details && (
                                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '0.75rem', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <pre style={{ fontSize: '0.75rem', color: '#d1d5db', margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                                {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: POLZA.AI */}
            {activeTab === 'polza' && (
                <div className={styles.polzaTab}>
                    <div className={styles.polzaStats}>
                        <div className={styles.polzaBalanceCard}>
                            <div className={styles.polzaBalanceLabel}>Текущий баланс Polza.ai</div>
                            <div className={styles.polzaBalanceValue}>
                                {isLoadingPolza ? <RefreshCw className={styles.spin} size={24} /> : `${polzaBalance || '0'} ₽`}
                            </div>
                            <button className={styles.polzaRefreshBtn} onClick={fetchPolzaData} disabled={isLoadingPolza}>
                                <RefreshCw size={14} className={isLoadingPolza ? styles.spin : ''} /> Обновить
                            </button>
                        </div>
                        <div className={styles.polzaInfoCard}>
                            <h3>Как это работает?</h3>
                            <p>Здесь вы видите официальный каталог моделей с сайта Polza.ai. Вы можете мгновенно добавить любую из них в свои настройки для использования в генерации текста или распознавании фото.</p>
                            <a href="https://polza.ai/dashboard" target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
                                Перейти в консоль Polza.ai
                            </a>
                        </div>
                    </div>

                    <div className={styles.catalogHeader}>
                        <h2 className={styles.cardTitle}>Каталог моделей</h2>
                        <div className={styles.catalogFilters}>
                            <select 
                                className={styles.filterSelect}
                                value={selectedProvider}
                                onChange={(e) => setSelectedProvider(e.target.value)}
                            >
                                <option value="all">Все провайдеры</option>
                                {Array.from(new Set(polzaModels.map(m => m.id.split('/')[0])))
                                    .sort()
                                    .map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))
                                }
                            </select>
                            <div className={styles.searchWrapper}>
                                <input 
                                    type="text" 
                                    placeholder="Поиск по названию или ID..." 
                                    className={styles.searchInput}
                                    value={polzaSearch}
                                    onChange={(e) => setPolzaSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {isLoadingPolza && polzaModels.length === 0 ? (
                        <div className={styles.loadingState} style={{ minHeight: '300px' }}><RefreshCw className={styles.spin} /> Загрузка каталога...</div>
                    ) : (
                        <div className={styles.modelGrid}>
                            {polzaModels
                                .filter(m => {
                                    const matchesSearch = !polzaSearch || 
                                        m.id.toLowerCase().includes(polzaSearch.toLowerCase()) || 
                                        m.name.toLowerCase().includes(polzaSearch.toLowerCase());
                                    const matchesProvider = selectedProvider === "all" || m.id.startsWith(selectedProvider + "/");
                                    return matchesSearch && matchesProvider;
                                })
                                .slice(0, 100) // Show first 100 to avoid lag
                                .map(model => {
                                    const inputPrice = model.top_provider?.pricing?.prompt_per_million 
                                        ? (parseFloat(model.top_provider.pricing.prompt_per_million) / 1000).toFixed(4)
                                        : "?";
                                    const outputPrice = model.top_provider?.pricing?.completion_per_million
                                        ? (parseFloat(model.top_provider.pricing.completion_per_million) / 1000).toFixed(4)
                                        : "?";
                                    
                                    return (
                                        <div key={model.id} className={styles.modelCard}>
                                            <div className={styles.modelCardHeader}>
                                                <div className={styles.modelName}>{model.name}</div>
                                                <div className={styles.modelId}>{model.id}</div>
                                            </div>
                                            <div className={styles.modelPrices}>
                                                <div className={styles.priceItem}>
                                                    <span className={styles.priceLabel}>Вход:</span>
                                                    <span className={styles.priceValue}>{inputPrice} ₽ <small>/1k</small></span>
                                                </div>
                                                <div className={styles.priceItem}>
                                                    <span className={styles.priceLabel}>Выход:</span>
                                                    <span className={styles.priceValue}>{outputPrice} ₽ <small>/1k</small></span>
                                                </div>
                                            </div>
                                            <div className={styles.modelCapabilities}>
                                                {model.architecture?.input_modalities?.map(cap => (
                                                    <span key={cap} className={styles.capBadge}>{cap}</span>
                                                ))}
                                                {model.architecture?.modality?.includes('vision') && (
                                                    <span className={styles.capBadge}>vision</span>
                                                )}
                                            </div>
                                            <div className={styles.modelActions}>
                                                <button 
                                                    className={styles.addToSettingsBtn}
                                                    onClick={() => {
                                                        const isVision = model.architecture?.modality?.includes('vision') || 
                                                                         model.architecture?.output_modalities?.includes('image');
                                                        const targetKey = isVision ? 'visionModels' : 'textModels';
                                                        const exists = settings[targetKey].some(m => m.id === model.id);
                                                        
                                                        if (exists) {
                                                            setMessage({ text: `Модель ${model.id} уже есть в настройках!`, type: "success" });
                                                            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
                                                            return;
                                                        }

                                                        const newModel = {
                                                            id: model.id,
                                                            name: model.name,
                                                            description: `Polza: ${model.id}. Цена: ${inputPrice} / ${outputPrice} ₽ за 1к отв.`,
                                                            provider: "polza",
                                                            tier: parseFloat(inputPrice) > 0 ? "premium" : "free",
                                                            modelType: isVision ? "vision" : "text",
                                                            enabled: true,
                                                            isCustom: true
                                                        };

                                                        setSettings(prev => ({
                                                            ...prev,
                                                            [targetKey]: [...prev[targetKey], newModel]
                                                        }));
                                                        
                                                        setMessage({ text: `Модель ${model.name} добавлена! Нажмите "Сохранить" вверху страницы.`, type: "success" });
                                                        setTimeout(() => setMessage({ text: "", type: "" }), 5000);
                                                    }}
                                                >
                                                    <Plus size={14} /> Добавить в настройки
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            )}

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
                        <h3 className={styles.modalTitle}>{settings.textModels.some(m => m.id === editingModel.id) || settings.visionModels.some(m => m.id === editingModel.id) ? "Редактировать модель" : "Добавить свою модель"}</h3>
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
                                        <option value="omniroute">OmniRoute</option>
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
                                {settings.textModels.some(m => m.id === editingModel.id) || settings.visionModels.some(m => m.id === editingModel.id) ? "Сохранить" : "Добавить"}
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
                            <h4 style={{ marginTop: '20px', marginBottom: '10px', fontSize: '14px', color: '#e4e4e7', borderBottom: '1px solid #3f3f46', paddingBottom: '8px' }}>
                                Блок 1: Настройки для Фото ИИ (Vision)
                            </h4>
                            <div className={styles.inputGroup} style={{ opacity: 0.7 }}>
                                <label style={{ color: '#a1a1aa' }}>Системный Промпт (Зашит в код для надежности, чтобы не ломался JSON Спартака)</label>
                                <textarea
                                    value={`СТРОГОЕ ПРАВИЛО: Описывай ТОЛЬКО то, что БУКВАЛЬНО ВИДИШЬ на фото. ЗАПРЕЩЕНО додумывать.
ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Весь твой ответ должен быть СТРОГО на русском языке.
ВАЖНОЕ ПРАВИЛО JSON: ЗАПРЕЩЕНО использовать двойные кавычки (") внутри текстовых значений!`}
                                    disabled
                                    className={styles.textareaInput}
                                    rows={4}
                                    style={{ fontFamily: 'monospace', fontSize: '13px', background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}
                                />
                            </div>

                            <h4 style={{ marginTop: '20px', marginBottom: '10px', fontSize: '14px', color: '#e4e4e7', borderBottom: '1px solid #3f3f46', paddingBottom: '8px' }}>
                                Блок 2: Настройки для Текстового ИИ (Генерация текста)
                            </h4>
                            <div className={styles.inputGroup}>
                                <label>Системная Роль (Основная инструкция копирайтера)</label>
                                <textarea
                                    value={editingBehavior.systemPrompt}
                                    onChange={e => setEditingBehavior({ ...editingBehavior, systemPrompt: e.target.value })}
                                    className={styles.textareaInput}
                                    placeholder="Твоя задача: Генерировать глубоко проработанные и содержательные описания..."
                                    rows={12}
                                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                                />
                            </div>

                            <h4 style={{ marginTop: '20px', marginBottom: '10px', fontSize: '14px', color: '#e4e4e7', borderBottom: '1px solid #3f3f46', paddingBottom: '8px' }}>
                                Технические настройки (Параметры генерации Text AI)
                            </h4>
                            <div className={styles.inputGroupRow}>
                                <div className={styles.inputGroup} style={{ flex: 1 }}>
                                    <label>Temperature (Температура)</label>
                                    <input
                                        type="number" step="0.1" min="0" max="2"
                                        value={editingBehavior.temperature ?? 0.5}
                                        onChange={e => setEditingBehavior({ ...editingBehavior, temperature: parseFloat(e.target.value) })}
                                        title="Баланс: 0.5 обеспечивает профессиональный, точный результат. Выше = больше креатива."
                                    />
                                </div>
                                <div className={styles.inputGroup} style={{ flex: 1 }}>
                                    <label>Top-P</label>
                                    <input
                                        type="number" step="0.05" min="0" max="1"
                                        value={editingBehavior.top_p ?? 0.9}
                                        onChange={e => setEditingBehavior({ ...editingBehavior, top_p: parseFloat(e.target.value) })}
                                        title="Позволяет модели выбирать наиболее естественные слова (0.9 обычно)."
                                    />
                                </div>
                                <div className={styles.inputGroup} style={{ flex: 1 }}>
                                    <label>Top-K</label>
                                    <input
                                        type="number" step="1" min="1" max="100"
                                        value={editingBehavior.top_k ?? 40}
                                        onChange={e => setEditingBehavior({ ...editingBehavior, top_k: parseInt(e.target.value) || 40 })}
                                        title="Ограничивает выборку слов, предотвращая странные термины (Обычно 40)."
                                    />
                                </div>
                            </div>
                            <div className={styles.inputGroupRow}>
                                <div className={styles.inputGroup} style={{ flex: 1 }}>
                                    <label>Repetition Penalty</label>
                                    <input
                                        type="number" step="0.05" min="1" max="2"
                                        value={editingBehavior.repetition_penalty ?? 1.15}
                                        onChange={e => setEditingBehavior({ ...editingBehavior, repetition_penalty: parseFloat(e.target.value) })}
                                        title="Штраф за повторы. Исключает повторение одних и тех же фраз (1.15 норм)."
                                    />
                                </div>
                                <div className={styles.inputGroup} style={{ flex: 1 }}>
                                    <label>Max Tokens</label>
                                    <input
                                        type="number" step="100" min="100" max="8000"
                                        value={editingBehavior.max_tokens ?? 2000}
                                        onChange={e => setEditingBehavior({ ...editingBehavior, max_tokens: parseInt(e.target.value) || 2000 })}
                                        title="Дает модели место, чтобы раскрыть описание (2000 обычно хватает)."
                                    />
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setEditingBehavior(null)}>Отмена</button>
                            <button
                                className={styles.saveModalBtn}
                                onClick={() => saveBehavior(editingBehavior)}
                                disabled={!editingBehavior.name || !editingBehavior.systemPrompt}
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: OMNIROUTE */}
            {activeTab === 'omniroute' && (
                <div className={styles.polzaTab}>
                    <div className={styles.polzaStats}>
                        <div className={styles.polzaInfoCard} style={{ gridColumn: '1 / -1' }}>
                            <h3>OmniRoute - AI Gateway</h3>
                            <p>OmniRoute предоставляет доступ к множеству AI моделей через единый API. Здесь вы можете просмотреть доступные модели и добавить их в свои настройки.</p>
                            <a href="http://89.208.14.46:20128/dashboard" target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
                                Перейти в дашборд OmniRoute
                            </a>
                        </div>
                    </div>

                    <div className={styles.catalogHeader}>
                        <h2 className={styles.cardTitle}>Каталог моделей OmniRoute</h2>
                        <div className={styles.catalogFilters}>
                            <select 
                                className={styles.filterSelect}
                                value={selectedOmnirouteProvider}
                                onChange={(e) => setSelectedOmnirouteProvider(e.target.value)}
                            >
                                <option value="all">Все провайдеры</option>
                                {Array.from(new Set(omnirouteModels.map(m => m.owned_by)))
                                    .sort()
                                    .map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))
                                }
                            </select>
                            <div className={styles.searchWrapper}>
                                <input 
                                    type="text" 
                                    placeholder="Поиск по названию или ID..." 
                                    className={styles.searchInput}
                                    value={omnirouteSearch}
                                    onChange={(e) => setOmnirouteSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {isLoadingOmniroute && omnirouteModels.length === 0 ? (
                        <div className={styles.loadingState} style={{ minHeight: '300px' }}><RefreshCw className={styles.spin} /> Загрузка каталога...</div>
                    ) : (
                        <div className={styles.modelGrid}>
                            {omnirouteModels
                                .filter(m => {
                                    const matchesSearch = !omnirouteSearch || 
                                        m.id.toLowerCase().includes(omnirouteSearch.toLowerCase()) || 
                                        m.root?.toLowerCase().includes(omnirouteSearch.toLowerCase());
                                    const matchesProvider = selectedOmnirouteProvider === "all" || m.owned_by === selectedOmnirouteProvider;
                                    return matchesSearch && matchesProvider;
                                })
                                .slice(0, 100)
                                .map(model => {
                                    const isVisionModel = model.type === 'vision' || model.id.includes('vision');
                                    const isAudioModel = model.type === 'audio';
                                    const isVideoModel = model.type === 'video';
                                    const isMusicModel = model.type === 'music';
                                    
                                    return (
                                        <div key={model.id} className={styles.modelCard}>
                                            <div className={styles.modelCardHeader}>
                                                <div className={styles.modelName}>{model.root || model.id}</div>
                                                <div className={styles.modelId}>{model.id}</div>
                                            </div>
                                            <div className={styles.modelCapabilities}>
                                                <span className={styles.capBadge}>{model.owned_by}</span>
                                                {isVisionModel && <span className={styles.capBadge}>vision</span>}
                                                {isAudioModel && <span className={styles.capBadge}>audio</span>}
                                                {isVideoModel && <span className={styles.capBadge}>video</span>}
                                                {isMusicModel && <span className={styles.capBadge}>music</span>}
                                                {model.subtype && <span className={styles.capBadge}>{model.subtype}</span>}
                                            </div>
                                            <div className={styles.modelActions}>
                                                <button 
                                                    className={styles.addToSettingsBtn}
                                                    onClick={() => {
                                                        const targetKey = isVisionModel ? 'visionModels' : 'textModels';
                                                        const exists = settings[targetKey].some(m => m.id === model.id);
                                                        
                                                        if (exists) {
                                                            setMessage({ text: `Модель ${model.id} уже есть в настройках!`, type: "success" });
                                                            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
                                                            return;
                                                        }

                                                        if (isAudioModel || isVideoModel || isMusicModel) {
                                                            setMessage({ text: `Модели типа ${model.type} пока не поддерживаются в настройках`, type: "error" });
                                                            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
                                                            return;
                                                        }

                                                        const newModel = {
                                                            id: model.id,
                                                            name: model.root || model.id,
                                                            description: `OmniRoute: ${model.id} (${model.owned_by})`,
                                                            provider: "omniroute",
                                                            tier: "premium",
                                                            modelType: isVisionModel ? "vision" : "text",
                                                            enabled: true,
                                                            isCustom: true
                                                        };

                                                        setSettings(prev => ({
                                                            ...prev,
                                                            [targetKey]: [...prev[targetKey], newModel]
                                                        }));
                                                        
                                                        setMessage({ text: `Модель ${model.root || model.id} добавлена! Нажмите "Сохранить" вверху страницы.`, type: "success" });
                                                        setTimeout(() => setMessage({ text: "", type: "" }), 5000);
                                                    }}
                                                    disabled={isAudioModel || isVideoModel || isMusicModel}
                                                >
                                                    <Plus size={14} /> Добавить в настройки
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
