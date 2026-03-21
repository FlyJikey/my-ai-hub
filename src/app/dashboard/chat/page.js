"use client";

import { useState, useRef, useEffect } from "react";
import { 
    Send, 
    Plus, 
    User, 
    Bot, 
    RefreshCw, 
    ChevronUp, 
    ChevronDown, 
    Image as ImageIcon, 
    X, 
    Copy, 
    Check, 
    AlertCircle,
    Settings as SettingsIcon,
    Zap,
    Layers,
    Sparkles,
    Globe,
    PanelLeft,
    Database
} from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import styles from "./page.module.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function AIHubChatPage() {
    const {
        selectedTextModel, setSelectedTextModel,
        availableTextModels,
        availableVisionModels,
        addToHistory
    } = useAppContext();

    // --- State: Multiple Chats ---
    const [chats, setChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    
    // UI States
    const [prompt, setPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);

    // Tools & Settings
    const [visionMode, setVisionMode] = useState("dual"); 
    const [selectedVisionProcessor, setSelectedVisionProcessor] = useState(null);
    const [currentStyle, setCurrentStyle] = useState("normal"); // normal, concise, formal, creative, code

    // Image handling
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [useCatalog, setUseCatalog] = useState(false);
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);
    const textareaRef = useRef(null);

    // --- Persistence ---
    useEffect(() => {
        try {
            const savedChats = localStorage.getItem('aiHub_chats_v3');
            if (savedChats) {
                const parsed = JSON.parse(savedChats);
                if (parsed.length > 0) {
                    setChats(parsed);
                    setActiveChatId(parsed[0].id);
                } else {
                    createNewChat();
                }
            } else {
                createNewChat();
            }

            const savedVisionMode = localStorage.getItem('aiHub_chat_visionMode');
            if (savedVisionMode) setVisionMode(savedVisionMode);
        } catch (e) {
            console.error("Failed to load chat data", e);
            createNewChat();
        }
    }, []);

    useEffect(() => {
        if (chats.length > 0) {
            // Strip large images from messages before saving to localStorage
            const chatsToSave = chats.map(chat => ({
                ...chat,
                messages: (chat.messages || []).map(m => {
                    const { image, ...rest } = m;
                    return rest;
                })
            }));
            localStorage.setItem('aiHub_chats_v3', JSON.stringify(chatsToSave));
        }
    }, [chats]);

    // Cleanup models
    useEffect(() => {
        if (!selectedVisionProcessor && availableVisionModels.length > 0) {
            setSelectedVisionProcessor(availableVisionModels[0]);
        }
    }, [availableVisionModels, selectedVisionProcessor]);

    // --- Chat Management ---
    const createNewChat = () => {
        const newChat = {
            id: Date.now().toString(),
            title: "Новый чат",
            messages: [],
            createdAt: new Date().toISOString()
        };
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setError("");
        setPrompt("");
        clearImage();
    };

    const deleteChat = (e, id) => {
        e.stopPropagation();
        if (window.confirm("Удалить этот чат?")) {
            const updated = chats.filter(c => c.id !== id);
            setChats(updated);
            if (activeChatId === id) {
                if (updated.length > 0) setActiveChatId(updated[0].id);
                else createNewChat();
            }
        }
    };

    const activeChat = chats.find(c => c.id === activeChatId) || chats[0] || null;
    const messages = activeChat?.messages || [];

    const updateActiveChatMessages = (newMessages) => {
        setChats(prev => prev.map(c => 
            c.id === activeChatId ? { ...c, messages: newMessages } : c
        ));
    };

    // --- Title Generation ---
    const generateTitle = async (firstMessage) => {
        try {
            const res = await fetch("/api/ai/title", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: firstMessage })
            });
            const data = await res.json();
            if (data.title) {
                setChats(prev => prev.map(c => 
                    c.id === activeChatId ? { ...c, title: data.title } : c
                ));
            }
        } catch (e) {
            console.error("Title gen failed", e);
        }
    };

    // --- Auto-scroll & UI Helpers ---
    const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(() => { scrollToBottom(); }, [messages, isProcessing]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [prompt]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith("image/")) { setError("Пожалуйста, выберите изображение."); return; }
            setError("");
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setImagePreview(ev.target.result);
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const isMultimodal = (model) => {
        const name = (model.name || "").toLowerCase();
        const id = (model.id || "").toLowerCase();
        return id.includes('gpt-4o') || id.includes('claude-3') || id.includes('gemini') || id.includes('vision') || name.includes('vision');
    };

    // --- Handling AI Logic ---
    const handleSend = async (overridePrompt = null) => {
        const textToSend = overridePrompt || prompt;
        if (!textToSend.trim() && !imageFile) return;
        
        const isSelectedMultimodal = isMultimodal(selectedTextModel);
        if (imageFile && visionMode === "direct" && !isSelectedMultimodal) {
             setError(`Выбранная модель (${selectedTextModel.name}) не поддерживает прямую работу с фото.`);
             return;
        }

        setError("");
        setIsProcessing(true);
        setIsToolsMenuOpen(false);

        const userMsg = {
            role: "user",
            text: textToSend.trim(),
            image: imagePreview,
            timestamp: new Date().toISOString()
        };

        const currentMessages = [...messages, userMsg];
        updateActiveChatMessages(currentMessages);
        
        const currentPrompt = textToSend;
        const currentImageFile = imageFile;
        const currentImagePreview = imagePreview;
        
        setPrompt("");
        clearImage();

        // Auto-title if first message
        if (messages.length === 0) generateTitle(currentPrompt);

        try {
            let finalPrompt = currentPrompt;
            
            // Vision Pass
            if (currentImageFile && visionMode === "dual") {
                const processor = selectedVisionProcessor || availableVisionModels[0];
                const formData = new FormData();
                formData.append("image", currentImageFile);
                formData.append("provider", processor.provider);
                formData.append("modelId", processor.id);
                formData.append("mode", "chat");

                const visRes = await fetch("/api/ai/vision", { method: "POST", body: formData });
                const visData = await visRes.json();
                if (visRes.ok && visData.result) {
                    const characteristics = Object.entries(visData.result.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
                    finalPrompt = `[Контекст изображения: ${visData.result.description || 'Изображение'}. ${characteristics}]\n\n${currentPrompt}`;
                }
            }

            // Catalog RAG Pass
            if (useCatalog) {
                try {
                    const searchRes = await fetch("/api/catalog/search", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query: currentPrompt, limit: 10 })
                    });
                    if (searchRes.ok) {
                        const searchData = await searchRes.json();
                        if (searchData.results && searchData.results.length > 0) {
                            const context = searchData.results.map((p, i) => 
                                `${i+1}. [Арт: ${p.sku}] ${p.name} | Кат: ${p.category} | Цена: ${p.price} руб. | ${JSON.stringify(p.attributes)}`
                            ).join("\n");
                            finalPrompt = `ДАННЫЕ ИЗ БАЗЫ ТОВАРОВ (используй их для ответа):\n${context}\n\nВОПРОС ПОЛЬЗОВАТЕЛЯ:\n${finalPrompt}`;
                        } else {
                            finalPrompt = `[Системное примечание: Пользователь попытался найти данные в базе товаров, но поиск по векторам ничего не дал. Скажи пользователю, что по его запросу в базе ничего не найдено.]\n\nВОПРОС ПОЛЬЗОВАТЕЛЯ:\n${finalPrompt}`;
                        }
                    } else {
                        throw new Error("Search API not OK");
                    }
                } catch (e) {
                    console.error("Catalog search failed", e);
                    finalPrompt = `[Системное примечание: Произошла техническая ошибка при поиске в базе товаров. Скажи пользователю, что не смог подключиться к базе.]\n\nВОПРОС ПОЛЬЗОВАТЕЛЯ:\n${finalPrompt}`;
                }
            }

            // System Styles
            const stylePrompts = {
                concise: "Отвечай максимально кратко и по делу. Без вступлений.",
                formal: "Используй официально-деловой стиль общения. Будь вежлив и структурирован.",
                creative: "Будь креативным, используй метафоры и вдохновляющий тон.",
                code: "Сфокусируйся на коде. Пиши чистый, документированный код с пояснениями.",
                normal: "Ты профессиональный ИИ-ассистент. Отвечай на русском языке."
            };

            const systemMsg = stylePrompts[currentStyle] || stylePrompts.normal;

            // Completion
            const requestBody = {
                prompt: finalPrompt, // Keep for backward compatibility
                provider: selectedTextModel.provider,
                modelId: selectedTextModel.id,
                chatHistory: [
                    { role: "system", content: systemMsg },
                    ...currentMessages.map((m, idx) => {
                        const isLastMessage = idx === currentMessages.length - 1;
                        let textContent = isLastMessage ? finalPrompt : m.text;

                        if (m.role === 'user' && m.image && visionMode === "direct" && isSelectedMultimodal) {
                            return {
                                role: "user",
                                content: [
                                    { type: "text", text: textContent || "Что на этом изображении?" },
                                    { type: "image_url", image_url: { url: m.image } }
                                ]
                            };
                        }
                        return { role: m.role === 'user' ? 'user' : 'assistant', content: textContent };
                    })
                ].slice(-10)
            };

            const res = await fetch("/api/ai/text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Ошибка API");

            const aiMsg = { role: "ai", text: data.result, timestamp: new Date().toISOString() };
            updateActiveChatMessages([...currentMessages, aiMsg]);
            addToHistory({ type: "chat", prompt: currentPrompt, data: data.result, model: selectedTextModel.name });

        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Tool Actions ---
    const optimizePrompt = async () => {
        if (!prompt.trim()) {
            setError("Пожалуйста, сначала напишите черновик вашего запроса в поле ниже.");
            setIsToolsMenuOpen(false);
            return;
        }
        setIsProcessing(true);
        setIsToolsMenuOpen(false);
        try {
            const res = await fetch("/api/ai/text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: `Улучши и разверни этот промпт для нейросети, чтобы получить лучший результат. Сохрани смысл, но добавь деталей. Ответь ТОЛЬКО улучшенным промптом:\n\n${prompt}`,
                    modelId: "openai/gpt-4o-mini",
                    provider: "polza"
                })
            });
            const data = await res.json();
            if (data.result) {
                setPrompt(data.result);
            } else if (data.error) {
                setError("Ошибка: " + data.error);
            }
        } catch (e) { setError("Не удалось улучшить промпт"); }
        finally { setIsProcessing(false); }
    };

    const fetchWebLink = async () => {
        const url = window.prompt("Введите URL для анализа:");
        if (!url) return;
        
        setIsProcessing(true);
        setIsToolsMenuOpen(false);
        setError("");

        try {
            const res = await fetch(`/api/proxy/fetch?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || "Ошибка при загрузке ссылки");

            const analysisPrompt = `Проанализируй содержимое этой страницы и кратко перескажи основные моменты:\n\nЗаголовок: ${data.title}\n\nТекст:\n${data.content}`;
            handleSend(analysisPrompt);
        } catch (err) {
            setError(err.message);
            setIsProcessing(false);
        }
    };

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className={styles.wrapper}>
            {/* Sidebar: Chat History */}
            <div className={`${styles.sidebar} ${!isSidebarOpen ? styles.sidebarHidden : ''}`}>
                <div className={styles.sidebarHeader}>
                    <button className={styles.btnNewChat} onClick={createNewChat}>
                        <Plus size={18} />
                        <span>Новый чат</span>
                    </button>
                </div>
                <div className={styles.sidebarScroll}>
                    {chats.map(chat => (
                        <button 
                            key={chat.id} 
                            className={`${styles.chatListItem} ${activeChatId === chat.id ? styles.chatListItemActive : ''}`}
                            onClick={() => setActiveChatId(chat.id)}
                        >
                            <Zap size={14} color={activeChatId === chat.id ? "#60a5fa" : "#4b5563"} />
                            <span className={styles.chatListItemTitle}>{chat.title}</span>
                            <X 
                                size={14} 
                                className={styles.btnDeleteChat} 
                                onClick={(e) => deleteChat(e, chat.id)} 
                            />
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.chatContainer}>
                {/* Header / Top Bar */}
                <div className={styles.topBar}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button 
                            className={styles.newChatBtn} 
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                            title={isSidebarOpen ? "Скрыть панель" : "Показать панель"}
                        >
                            <PanelLeft size={20} />
                        </button>
                        <div className={styles.modelDropdownContainer}>
                            <button className={styles.modelDropdownButton} onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}>
                                <Bot size={18} color="#10b981" />
                                <span>{selectedTextModel?.name || 'Загрузка...'}</span>
                                {isModelMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {isModelMenuOpen && (
                                <div className={styles.modelDropdownMenu}>
                                    {availableTextModels?.map(m => (
                                        <button 
                                            key={m.id} 
                                            className={`${styles.modelOption} ${selectedTextModel.id === m.id ? styles.modelOptionActive : ''}`}
                                            onClick={() => { setSelectedTextModel(m); setIsModelMenuOpen(false); }}
                                        >
                                            <div className={styles.modelHeader}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>{m.name}</span>
                                                    {isMultimodal(m) && <span className={styles.modelBadgeVision}><Sparkles size={10} /> Vision</span>}
                                                </div>
                                                <span className={m.tier === 'free' ? styles.modelBadgeFree : styles.modelBadgePremium}>
                                                    {m.tier === 'free' ? 'FREE' : 'PRO'}
                                                </span>
                                            </div>
                                            <div className={styles.modelDesc}>{m.description}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.topBarRight}>
                        <button 
                            className={`${styles.settingsToggle} ${isSettingsOpen ? styles.settingsToggleActive : ''}`}
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            title="Настройки Vision"
                        >
                            <SettingsIcon size={18} />
                        </button>
                    </div>

                    {isSettingsOpen && (
                        <div className={styles.settingsPanel}>
                            <div className={styles.settingsTitle}><SettingsIcon size={18} /><span>Vision Настройки</span></div>
                            
                            <div className={styles.settingsGroup}>
                                <label className={styles.settingsLabel}>Используемая нейросеть для фото</label>
                                <select 
                                    className={styles.visionSelect} 
                                    value={selectedVisionProcessor?.id || ''} 
                                    onChange={(e) => {
                                        const model = availableVisionModels.find(m => m.id === e.target.value);
                                        if (model) setSelectedVisionProcessor(model);
                                    }}
                                >
                                    {availableVisionModels.map(vm => (
                                        <option key={vm.id} value={vm.id}>{vm.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.settingsGroup}>
                                <label className={styles.settingsLabel}>Режим фото</label>
                                <div className={styles.toggleContainer} onClick={() => setVisionMode(prev => prev === "dual" ? "direct" : "dual")}>
                                    <div className={styles.toggleText}>
                                        <div className={styles.toggleTitle}>{visionMode === "dual" ? "Оптимизированный" : "Прямой"}</div>
                                        <div className={styles.toggleDesc}>{visionMode === "dual" ? "Сначала анализ, затем текст" : "Напрямую в модель"}</div>
                                    </div>
                                    <div className={`${styles.switch} ${visionMode === "direct" ? styles.switchActive : ''}`}><div className={styles.switchKnob}></div></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.chatMain}>
                    {/* Messages List */}
                    <div className={styles.chatHistory}>
                        {messages.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '2rem', borderRadius: '50%', marginBottom: '2rem' }}>
                                    <Sparkles size={48} color="#10b981" />
                                </div>
                                <h3>Привет! Я твой ИИ-помощник</h3>
                                <p>Выбери модель выше и начни общение.<br/>Я поддерживаю анализ фото, генерацию кода и многое другое.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAi}`}>
                                    <div className={`${styles.avatar} ${msg.role === 'user' ? styles.avatarUser : styles.avatarAi}`}>
                                        {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                                    </div>
                                    <div className={styles.messageContent}>
                                        {msg.image && <img src={msg.image} alt="Upload" className={styles.attachedImage} />}
                                        <div className={styles.markdownContent}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.text}
                                            </ReactMarkdown>
                                        </div>
                                        {msg.role === 'ai' && (
                                            <button className={styles.copyBtn} onClick={() => handleCopy(msg.text, idx)}>
                                                {copiedIndex === idx ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                                                {copiedIndex === idx ? "Скопировано" : "Копировать"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        {isProcessing && (
                            <div className={`${styles.message} ${styles.messageAi}`}>
                                <div className={`${styles.avatar} ${styles.avatarAi}`}><Bot size={20} /></div>
                                <div className={styles.messageContent} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#6b7280' }}>
                                    <RefreshCw size={18} className={styles.spin} /> Думаю...
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className={styles.inputArea}>
                        {error && <div className={styles.errorLabel}><AlertCircle size={16} />{error}</div>}
                        
                        <div className={styles.inputWrapper}>
                            {/* Tools Menu Toolbar */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                <div className={styles.styleBadge} title="Текущий стиль">
                                     {currentStyle === 'concise' ? 'Кратко' : currentStyle === 'formal' ? 'Деловой' : currentStyle === 'creative' ? 'Творческий' : currentStyle === 'code' ? 'Код' : 'Обычный'}
                                </div>
                                <button 
                                    onClick={() => setUseCatalog(!useCatalog)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', 
                                        padding: '4px 10px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                        background: useCatalog ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                        color: useCatalog ? '#10b981' : '#6b7280',
                                        border: useCatalog ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #374151',
                                        transition: 'all 0.2s'
                                    }}
                                    title="Включить поиск по загруженной Базе товаров"
                                >
                                    <Database size={14} />
                                    {useCatalog ? 'База: ВКЛЮЧЕНА' : 'База товаров'}
                                </button>
                            </div>

                            <div className={styles.mainInputRow}>
                                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept="image/*" />
                                
                                <div style={{ position: 'relative' }}>
                                    <button 
                                        className={styles.btnAttach} 
                                        onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)} 
                                        title="Инструменты"
                                    >
                                        <Plus size={22} style={{ transform: isToolsMenuOpen ? 'rotate(45deg)' : 'none', transition: '0.2s' }} />
                                    </button>

                                    {isToolsMenuOpen && (
                                        <div className={styles.toolsMenuContainer}>
                                            <button className={styles.toolItem} onClick={() => fileInputRef.current?.click()}>
                                                <div className={styles.toolIcon}><ImageIcon size={18} /></div>
                                                <div className={styles.toolContent}>
                                                    <div>Прикрепить фото</div>
                                                    <div className={styles.toolSubLabel}>Анализ изображений</div>
                                                </div>
                                            </button>
                                            <button className={styles.toolItem} onClick={optimizePrompt}>
                                                <div className={styles.toolIcon}><Zap size={18} /></div>
                                                <div className={styles.toolContent}>
                                                    <div>Улучшить промпт</div>
                                                    <div className={styles.toolSubLabel}>Сделать запрос точнее</div>
                                                </div>
                                            </button>
                                            <button className={styles.toolItem} onClick={fetchWebLink}>
                                                <div className={styles.toolIcon}><Globe size={18} /></div>
                                                <div className={styles.toolContent}>
                                                    <div>Анализ ссылки</div>
                                                    <div className={styles.toolSubLabel}>Прочитать сайт по URL</div>
                                                </div>
                                            </button>
                                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 8px' }}></div>

                                            <div style={{ padding: '8px 12px', fontSize: '0.7rem', color: '#4b5563', fontWeight: 'bold' }}>СТИЛЬ ОТВЕТА</div>
                                            {['normal', 'concise', 'formal', 'creative', 'code'].map(s => (
                                                <button 
                                                    key={s} 
                                                    className={`${styles.toolItem} ${currentStyle === s ? styles.chatListItemActive : ''}`}
                                                    onClick={() => { setCurrentStyle(s); setIsToolsMenuOpen(false); }}
                                                >
                                                    <div className={styles.toolContent}>
                                                        {s === 'normal' ? 'Обычный' : s === 'concise' ? 'Краткий' : s === 'formal' ? 'Деловой' : s === 'creative' ? 'Творческий' : 'Код'}
                                                    </div>
                                                    {currentStyle === s && <Check size={14} color="#60a5fa" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {imagePreview && (
                                    <div className={styles.imagePreviewWrapper}>
                                        <img src={imagePreview} alt="P" className={styles.imagePreviewSmall} />
                                        <button className={styles.btnRemoveSmall} onClick={clearImage}><X size={12} /></button>
                                    </div>
                                )}

                                <div className={styles.textareaContainer}>
                                    <textarea
                                        ref={textareaRef}
                                        className={styles.textarea}
                                        placeholder="Напишите сообщение..."
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                        rows={1}
                                    />
                                </div>

                                <button className={styles.btnSend} onClick={() => handleSend()} disabled={isProcessing || (!prompt.trim() && !imageFile)}>
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
