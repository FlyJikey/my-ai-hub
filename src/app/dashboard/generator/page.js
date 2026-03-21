"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Copy, Check, AlertCircle, Image as ImageIcon, UploadCloud, X, Send, User, Bot, RefreshCw, ChevronUp, ChevronDown, ListFilter, Plus, MessageSquare, Trash2 } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import styles from "./page.module.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function UnifiedGeneratorPage() {
    const {
        selectedTextModel, setSelectedTextModel,
        selectedVisionModel, setSelectedVisionModel,
        availableTextModels, availableVisionModels, availableScenarios,
        addToHistory,
        addAnalysisLog
    } = useAppContext();

    // Chat persistence
    const [chatId, setChatId] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('aiHub_activeChatId') || Date.now().toString();
        }
        return Date.now().toString();
    });
    const [chatList, setChatList] = useState([]);
    const [isChatListOpen, setIsChatListOpen] = useState(false);

    // Local state for the Chat interface
    const [messages, setMessages] = useState([]);
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [isVisionMenuOpen, setIsVisionMenuOpen] = useState(false);
    const [isScenariosOpen, setIsScenariosOpen] = useState(false);
    const [activeScenario, setActiveScenario] = useState(null);

    // Input state
    const [prompt, setPrompt] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);

    // Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [lastVisionResult, setLastVisionResult] = useState(null);

    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);

    // Load chat list on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('aiHub_chatList');
            if (saved) setChatList(JSON.parse(saved));
        } catch (e) { console.error('Failed to load chat list', e); }
    }, []);

    // Load messages for current chatId
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`aiHub_chat_${chatId}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                setMessages(parsed.messages || []);
                setLastVisionResult(parsed.lastVisionResult || null);
            } else {
                setMessages([]);
                setLastVisionResult(null);
            }
            localStorage.setItem('aiHub_activeChatId', chatId);
        } catch (e) { console.error('Failed to load chat', e); }
    }, [chatId]);

    // Save messages whenever they change
    useEffect(() => {
        if (messages.length > 0) {
            try {
                localStorage.setItem(`aiHub_chat_${chatId}`, JSON.stringify({
                    messages,
                    lastVisionResult
                }));
                // Update chat list
                setChatList(prev => {
                    const firstUserMsg = messages.find(m => m.role === 'user');
                    const title = firstUserMsg?.text?.substring(0, 50) || 'Новый чат';
                    const exists = prev.find(c => c.id === chatId);
                    let updated;
                    if (exists) {
                        updated = prev.map(c => c.id === chatId ? { ...c, title, updatedAt: Date.now() } : c);
                    } else {
                        updated = [{ id: chatId, title, createdAt: Date.now(), updatedAt: Date.now() }, ...prev];
                    }
                    updated.sort((a, b) => b.updatedAt - a.updatedAt);
                    localStorage.setItem('aiHub_chatList', JSON.stringify(updated.slice(0, 30)));
                    return updated.slice(0, 30);
                });
            } catch (e) { console.error('Failed to save chat', e); }
        }
    }, [messages, chatId, lastVisionResult]);

    // Auto-scroll to bottom of chat
    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isProcessing]);

    // --- Chat Management ---
    const startNewChat = () => {
        const newId = Date.now().toString();
        setChatId(newId);
        setMessages([]);
        setLastVisionResult(null);
        setPrompt("");
        setError("");
        setActiveScenario(null);
        clearImage();
        setIsChatListOpen(false);
    };

    const switchChat = (id) => {
        setChatId(id);
        setPrompt("");
        setError("");
        setActiveScenario(null);
        setIsChatListOpen(false);
    };

    const deleteChat = (id, e) => {
        e.stopPropagation();
        localStorage.removeItem(`aiHub_chat_${id}`);
        setChatList(prev => {
            const updated = prev.filter(c => c.id !== id);
            localStorage.setItem('aiHub_chatList', JSON.stringify(updated));
            return updated;
        });
        if (id === chatId) startNewChat();
    };

    // --- Image Handling ---
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith("image/")) {
                setError("Пожалуйста, выберите изображение (JPEG, PNG, WEBP).");
                return;
            }
            setError("");
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (e) => setImagePreview(e.target.result);
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSelectScenario = (scenario) => {
        if (activeScenario?.id === scenario.id) {
            setActiveScenario(null);
            setPrompt("");
        } else {
            setActiveScenario(scenario);
            setPrompt("");
        }
        setIsScenariosOpen(false);
    };

    const clearScenario = () => {
        setActiveScenario(null);
        setPrompt("");
    };

    // --- Core Generation Flow ---
    const handleSend = async () => {
        const effectivePrompt = activeScenario ? activeScenario.name : prompt.trim();
        const hasImage = !!imageFile;

        // Validate: need either scenario or text
        if (!effectivePrompt && !activeScenario) return;

        // If first message and no image, require photo
        if (!hasImage && messages.length === 0) {
            setError("Прикрепите фото товара для первого запроса.");
            return;
        }

        // If scenario selected but no image, require photo
        if (activeScenario && !hasImage && !lastVisionResult) {
            setError("Прикрепите фото товара для сценария.");
            return;
        }

        // If continuing without photo, only allow free models
        if (!hasImage && messages.length > 0 && selectedTextModel.tier !== 'free') {
            setError("Продолжение диалога без фото доступно только с бесплатными моделями. Выберите бесплатную модель для текста.");
            return;
        }

        setError("");
        setIsProcessing(true);

        const userMsg = {
            role: "user",
            text: activeScenario ? `🎯 Сценарий: ${activeScenario.name}` : prompt,
            image: hasImage ? imagePreview : null
        };
        setMessages(prev => [...prev, userMsg]);

        const currentPrompt = activeScenario ? activeScenario.prompt : prompt;
        const currentImageFile = hasImage ? imageFile : null;
        if (!activeScenario) setPrompt("");
        if (hasImage) clearImage();

        try {
            let visionResult = lastVisionResult;

            // If new image is attached, run Vision
            if (currentImageFile) {
                const formData = new FormData();
                formData.append("image", currentImageFile);
                formData.append("provider", selectedVisionModel.provider);
                formData.append("modelId", selectedVisionModel.id);

                const visionRes = await fetch("/api/ai/vision", {
                    method: "POST",
                    body: formData,
                });

                const visionDataResponse = await visionRes.json();
                if (!visionRes.ok) throw new Error(visionDataResponse.error || "Ошибка Vision API");
                visionResult = visionDataResponse.result;
                setLastVisionResult(visionResult);

                addToHistory({ type: "vision", data: visionResult, model: selectedVisionModel.name });
            }

            // Build contextual prompt
            let contextualPrompt;

            if (visionResult) {
                // Has vision data (from current or previous photo)
                const characteristics = Object.entries(visionResult.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
                const tags = (visionResult.tags || []).join(", ");

                const visionContext = `
Данные от модуля распознавания фото:
- Название/Модель товара: ${visionResult.productName || "Неизвестно"}
- Описание: ${visionResult.description || "нет описания"}
- Характеристики: ${characteristics}
- Теги: ${tags}
`;

                if (activeScenario) {
                    contextualPrompt = `${visionContext}\n${currentPrompt}\n\nПиши только на русском языке, без лишних вступлений, сразу выдай готовый Markdown код (без оберток \`\`\`markdown).`;
                } else {
                    contextualPrompt = `${visionContext}\nЗадача от пользователя: ${currentPrompt}\n\nСтрого следуй указаниям пользователя. Пиши только на русском языке, без лишних вступлений, сразу выдай готовый Markdown код (без оберток \`\`\`markdown).`;
                }

                // Log analysis data to context
                if (currentImageFile) {
                    addAnalysisLog({
                        visionResult,
                        contextualPrompt,
                        visionModel: selectedVisionModel.name,
                        textModel: selectedTextModel.name,
                        userPrompt: activeScenario ? activeScenario.name : prompt
                    });
                }
            } else {
                // Text-only continuation (no vision data at all)
                contextualPrompt = currentPrompt;
            }

            // Build conversation history for continuation
            const chatMessages = [{ role: "system", content: "You are a professional SEO copywriter. Write detailed, engaging, and rich texts in Russian based on the facts provided. Keep foreign brand names, models, and text from the image in their original language, do not translate them." }];
            // Include last few messages for context (max 6)
            const recentMsgs = messages.slice(-6);
            for (const m of recentMsgs) {
                chatMessages.push({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.text
                });
            }
            chatMessages.push({ role: 'user', content: contextualPrompt });

            // Fetch Text Generation
            const textRes = await fetch("/api/ai/text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: contextualPrompt,
                    provider: selectedTextModel.provider,
                    modelId: selectedTextModel.id,
                    chatHistory: chatMessages
                }),
            });

            const textDataResponse = await textRes.json();
            if (!textRes.ok) throw new Error(textDataResponse.error || "Ошибка Text API");

            const finalGeneratedText = textDataResponse.result;
            addToHistory({ type: "text", prompt: currentPrompt, data: finalGeneratedText, model: selectedTextModel.name });

            const aiMsg = {
                role: "ai",
                text: finalGeneratedText,
                visionAttributes: visionResult?.attributes,
                tags: visionResult?.tags
            };
            setMessages(prev => [...prev, aiMsg]);

        } catch (err) {
            setError(err.message || "Произошла ошибка при генерации.");
            // If it failed, pop the user message back out or add an error message? 
            // Better to show error globally so user can try again.
        } finally {
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
            <div className={styles.chatContainer}>

                {/* Top Bar for Model Switcher */}
                <div className={styles.topBar}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className={styles.newChatBtn} onClick={startNewChat} title="Новый чат">
                            <Plus size={16} />
                        </button>
                        <div className={styles.modelDropdownContainer}>
                            <button
                                className={styles.chatListBtn}
                                onClick={() => { setIsChatListOpen(!isChatListOpen); setIsModelMenuOpen(false); setIsVisionMenuOpen(false); setIsScenariosOpen(false); }}
                                title="Сохранённые чаты"
                            >
                                <MessageSquare size={14} />
                                <span>{chatList.length}</span>
                            </button>
                            {isChatListOpen && (
                                <div className={`${styles.modelDropdownMenu} ${styles.chatListMenu}`}>
                                    {chatList.length === 0 ? (
                                        <div style={{ padding: '1rem', color: '#6b7280', fontSize: '0.82rem', textAlign: 'center' }}>Нет сохранённых чатов</div>
                                    ) : chatList.map(c => (
                                        <div
                                            key={c.id}
                                            className={`${styles.modelOption} ${c.id === chatId ? styles.modelOptionActive : ''}`}
                                            onClick={() => switchChat(c.id)}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div className={styles.chatListItem}>
                                                <span className={styles.chatListTitle}>{c.title}</span>
                                                <button className={styles.chatDeleteBtn} onClick={(e) => deleteChat(c.id, e)} title="Удалить чат">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <div className={styles.modelDropdownContainer}>
                            <button
                                className={styles.modelDropdownButton}
                                onClick={() => { setIsModelMenuOpen(!isModelMenuOpen); setIsVisionMenuOpen(false); setIsScenariosOpen(false); }}
                                title="Выбрать нейросеть для текста"
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    📝 Текст: {selectedTextModel.name}
                                </span>
                                {isModelMenuOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                            </button>

                            {isModelMenuOpen && (
                                <div className={styles.modelDropdownMenu}>
                                    {availableTextModels?.map(m => (
                                        <button
                                            key={m.key || m.id}
                                            className={`${styles.modelOption} ${selectedTextModel.id === m.id ? styles.modelOptionActive : ''}`}
                                            onClick={() => {
                                                setSelectedTextModel(m);
                                                setIsModelMenuOpen(false);
                                            }}
                                        >
                                            <div className={styles.modelHeader}>
                                                <span>{m.name}</span>
                                                <span className={m.tier === 'economy' ? styles.modelBadgeEconomy : m.tier === 'free' ? styles.modelBadgeFree : styles.modelBadgePremium}>
                                                    {m.tier === 'economy' ? 'ЭКОНОМ' : m.tier === 'free' ? 'БЕСПЛАТНО' : 'PRO'}
                                                </span>
                                            </div>
                                            <div className={styles.modelDesc}>{m.description}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={styles.modelDropdownContainer}>
                            <button
                                className={styles.modelDropdownButton}
                                onClick={() => { setIsVisionMenuOpen(!isVisionMenuOpen); setIsModelMenuOpen(false); setIsScenariosOpen(false); }}
                                title="Выбрать нейросеть для фото"
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    👁️ Фото: {selectedVisionModel.name}
                                </span>
                                {isVisionMenuOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                            </button>

                            {isVisionMenuOpen && (
                                <div className={styles.modelDropdownMenu}>
                                    {availableVisionModels?.map(m => (
                                        <button
                                            key={m.key || m.id}
                                            className={`${styles.modelOption} ${selectedVisionModel.id === m.id ? styles.modelOptionActive : ''}`}
                                            onClick={() => {
                                                setSelectedVisionModel(m);
                                                setIsVisionMenuOpen(false);
                                            }}
                                        >
                                            <div className={styles.modelHeader}>
                                                <span>{m.name}</span>
                                                <span className={m.tier === 'economy' ? styles.modelBadgeEconomy : m.tier === 'free' ? styles.modelBadgeFree : styles.modelBadgePremium}>
                                                    {m.tier === 'economy' ? 'ЭКОНОМ' : m.tier === 'free' ? 'БЕСПЛАТНО' : 'PRO'}
                                                </span>
                                            </div>
                                            <div className={styles.modelDesc}>{m.description}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Scenarios Burger Menu (Right Side) */}
                    <div className={styles.modelDropdownContainer}>
                        <button
                            className={`${styles.scenarioBtn} ${activeScenario ? styles.scenarioBtnActive : ''}`}
                            onClick={() => { setIsScenariosOpen(!isScenariosOpen); setIsModelMenuOpen(false); setIsVisionMenuOpen(false); }}
                            title="Сценарии"
                        >
                            <ListFilter size={16} />
                            <span>{activeScenario ? activeScenario.name : 'Сценарии'}</span>
                        </button>

                        {isScenariosOpen && (
                            <div className={`${styles.modelDropdownMenu} ${styles.scenariosMenu}`}>
                                {availableScenarios?.map(s => (
                                    <button
                                        key={s.id}
                                        className={`${styles.modelOption} ${activeScenario?.id === s.id ? styles.modelOptionActive : ''}`}
                                        onClick={() => handleSelectScenario(s)}
                                    >
                                        <div className={styles.modelHeader}>
                                            <span>{s.icon} {s.name}</span>
                                        </div>
                                        <div className={styles.modelDesc}>{s.description}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Active Scenario Indicator */}
                {activeScenario && (
                    <div className={styles.scenarioIndicator}>
                        <span>{activeScenario.icon} Активный сценарий: <strong>{activeScenario.name}</strong></span>
                        <button className={styles.scenarioClearBtn} onClick={clearScenario}>
                            <X size={14} /> Сбросить
                        </button>
                    </div>
                )}

                {/* Chat History */}
                <div className={styles.chatHistory}>
                    {messages.length === 0 ? (
                        <div className={styles.emptyState}>
                            <Sparkles size={48} opacity={0.3} style={{ marginBottom: '1rem' }} />
                            <h3>Чат пуст</h3>
                            <p>{activeScenario
                                ? `Прикрепите фото товара и нажмите отправить.\nСценарий: ${activeScenario.name}`
                                : 'Загрузите фотографию товара внизу и напишите задачу,\nили выберите сценарий справа.'}
                            </p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAi}`}>
                                <div className={`${styles.avatar} ${msg.role === 'user' ? styles.avatarUser : styles.avatarAi}`}>
                                    {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                                </div>
                                <div className={styles.messageContent}>
                                    {msg.role === 'user' && msg.image && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={msg.image} alt="Upload" className={styles.attachedImage} />
                                    )}

                                    <div className={styles.markdownContent}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>

                                    {msg.role === 'ai' && msg.visionAttributes && (
                                        <div className={styles.attributesGrid}>
                                            {Object.entries(msg.visionAttributes).map(([k, v]) => (
                                                <div key={k}>
                                                    <div className={styles.attrLabel}>{k}</div>
                                                    <div className={styles.attrValue}>{v}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {msg.role === 'ai' && (
                                        <button className={styles.copyBtn} onClick={() => handleCopy(msg.text, idx)}>
                                            {copiedIndex === idx ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                                            {copiedIndex === idx ? "Скопировано" : "Копировать"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}

                    {isProcessing && (
                        <div className={`${styles.message} ${styles.messageAi}`}>
                            <div className={`${styles.avatar} ${styles.avatarAi}`}>
                                <Bot size={18} />
                            </div>
                            <div className={styles.messageContent} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280' }}>
                                <RefreshCw size={16} className={styles.spin} />
                                ИИ анализирует и пишет текст...
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Fixed Input Area at Bottom */}
                <div className={styles.inputArea}>

                    {error && (
                        <div className={styles.imageWarning}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className={styles.mainInputRow}>
                        {/* Hidden File Input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />

                        {/* Image Attachment Button / Preview */}
                        {!imagePreview ? (
                            <button className={styles.btnAttach} onClick={() => fileInputRef.current?.click()} title="Прикрепить фото">
                                <ImageIcon size={20} />
                            </button>
                        ) : (
                            <div className={styles.imagePreviewWrapper}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={imagePreview} alt="Preview" className={styles.imagePreviewSmall} />
                                <button className={styles.btnRemoveSmall} onClick={clearImage}>
                                    <X size={10} />
                                </button>
                            </div>
                        )}

                        {/* Text Area — disabled when scenario is active */}
                        <div className={styles.textareaContainer}>
                            <textarea
                                className={styles.textarea}
                                placeholder={activeScenario ? `🎯 ${activeScenario.name} — просто прикрепите фото` : "Напишите свой запрос..."}
                                value={activeScenario ? '' : prompt}
                                onChange={(e) => !activeScenario && setPrompt(e.target.value)}
                                disabled={!!activeScenario}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                        </div>

                        {/* Send Button */}
                        <button
                            className={styles.btnSend}
                            onClick={handleSend}
                            disabled={isProcessing || (!activeScenario && !prompt.trim()) || (!imageFile && messages.length === 0)}
                            title="Отправить"
                        >
                            <Send size={18} style={{ marginLeft: '2px' }} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
