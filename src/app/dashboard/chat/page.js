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
    Sparkles
} from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import styles from "./page.module.css";

export default function AIHubChatPage() {
    const {
        selectedTextModel, setSelectedTextModel,
        availableTextModels,
        selectedVisionModel,
        availableVisionModels,
        addToHistory
    } = useAppContext();

    // Chat persistence
    const [messages, setMessages] = useState([]);
    const [prompt, setPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);

    // Vision Settings
    const [visionMode, setVisionMode] = useState("dual"); // "dual" or "direct"
    const [selectedVisionProcessor, setSelectedVisionProcessor] = useState(null);

    // Image handling
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Load settings and messages from localStorage on mount
    useEffect(() => {
        try {
            const savedMsgs = localStorage.getItem('aiHub_standalone_chat');
            if (savedMsgs) setMessages(JSON.parse(savedMsgs));

            const savedVisionMode = localStorage.getItem('aiHub_chat_visionMode');
            if (savedVisionMode) setVisionMode(savedVisionMode);

            const savedVisionProcId = localStorage.getItem('aiHub_chat_visionProcessor');
            if (savedVisionProcId && availableVisionModels.length > 0) {
                const proc = availableVisionModels.find(m => m.id === savedVisionProcId);
                if (proc) setSelectedVisionProcessor(proc);
            }
        } catch (e) {
            console.error("Failed to load standalone chat data", e);
        }
    }, [availableVisionModels]);

    // Set default vision processor if not set
    useEffect(() => {
        if (!selectedVisionProcessor && availableVisionModels.length > 0) {
            setSelectedVisionProcessor(availableVisionModels[0]);
        }
    }, [availableVisionModels, selectedVisionProcessor]);

    // Save vision settings
    useEffect(() => {
        localStorage.setItem('aiHub_chat_visionMode', visionMode);
    }, [visionMode]);

    useEffect(() => {
        if (selectedVisionProcessor) {
            localStorage.setItem('aiHub_chat_visionProcessor', selectedVisionProcessor.id);
        }
    }, [selectedVisionProcessor]);

    // Save messages to localStorage (strip images to avoid QuotaExceededError)
    useEffect(() => {
        if (messages.length > 0) {
            try {
                const messagesToSave = messages.map(m => {
                    const { image, ...rest } = m;
                    return rest;
                });
                localStorage.setItem('aiHub_standalone_chat', JSON.stringify(messagesToSave));
            } catch (e) {
                console.error("Failed to saveStandaloneChat", e);
                if (e.name === 'QuotaExceededError') {
                    // If still exceeding, save only last 10 messages
                    try {
                        const limited = messages.slice(-10).map(m => {
                            const { image, ...rest } = m;
                            return rest;
                        });
                        localStorage.setItem('aiHub_standalone_chat', JSON.stringify(limited));
                    } catch (e2) {
                        console.error("Critical storage error", e2);
                    }
                }
            }
        }
    }, [messages]);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isProcessing]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [prompt]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith("image/")) {
                setError("Пожалуйста, выберите изображение.");
                return;
            }
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

    const startNewChat = () => {
        if (window.confirm("Очистить текущий чат?")) {
            setMessages([]);
            localStorage.removeItem('aiHub_standalone_chat');
            setPrompt("");
            setError("");
            clearImage();
        }
    };

    const isMultimodal = (model) => {
        const id = model.id.toLowerCase();
        const name = model.name.toLowerCase();
        return id.includes('gpt-4o') || 
               id.includes('claude-3') || 
               id.includes('gemini') || 
               id.includes('vision') ||
               name.includes('vision') ||
               model.modelType === 'vision';
    };

    const handleSend = async () => {
        if (!prompt.trim() && !imageFile) return;
        
        const isSelectedMultimodal = isMultimodal(selectedTextModel);

        if (imageFile && visionMode === "direct" && !isSelectedMultimodal) {
             setError(`Выбранная модель (${selectedTextModel.name}) не поддерживает прямую работу с фото. Включите "Оптимизированный режим" в настройках или выберите другую модель (например GPT-4o).`);
             return;
        }

        setError("");
        setIsProcessing(true);

        const userMsg = {
            role: "user",
            text: prompt.trim(),
            image: imagePreview
        };

        setMessages(prev => [...prev, userMsg]);
        const currentPrompt = prompt;
        const currentImageFile = imageFile;
        const currentImagePreview = imagePreview;
        
        setPrompt("");
        clearImage();

        try {
            let contextResult = null;
            let finalPrompt = currentPrompt;
            
            // --- Mode A: Dual Model (Vision Pass) ---
            if (currentImageFile && visionMode === "dual") {
                const processor = selectedVisionProcessor || availableVisionModels[0];
                const formData = new FormData();
                formData.append("image", currentImageFile);
                formData.append("provider", processor.provider);
                formData.append("modelId", processor.id);
                formData.append("mode", "general"); // Use general description for chat

                const visRes = await fetch("/api/ai/vision", {
                    method: "POST",
                    body: formData
                });
                const visData = await visRes.json();
                if (visRes.ok && visData.result) {
                    contextResult = visData.result;
                    const characteristics = Object.entries(contextResult.attributes || {})
                        .map(([k, v]) => `${k}: ${v}`).join(", ");
                    finalPrompt = `[Контекст изображения: ${contextResult.description || 'Изображение'}. ${characteristics}]\n\n${currentPrompt}`;
                }
            }

            // --- Chat Completion ---
            let requestBody = {
                prompt: finalPrompt,
                provider: selectedTextModel.provider,
                modelId: selectedTextModel.id,
            };

            // Prepare history
            const chatHistory = [
                { role: "system", content: "You are a helpful AI assistant in the AI HUB dashboard. You can help with text generation, analysis, and general questions. Always respond in Russian unless asked otherwise." },
                ...messages.map(m => ({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.text
                }))
            ];

            // Mode B: Direct Multimodal
            if (currentImageFile && visionMode === "direct" && isSelectedMultimodal) {
                // OpenAI format for multimodal
                chatHistory.push({
                    role: "user",
                    content: [
                        { type: "text", text: currentPrompt || "Что на этом изображении?" },
                        { 
                            type: "image_url", 
                            image_url: { url: currentImagePreview } 
                        }
                    ]
                });
                requestBody.prompt = currentPrompt || "Что на этом изображении?"; // Fallback field
            } else {
                chatHistory.push({ role: "user", content: finalPrompt });
            }

            requestBody.chatHistory = chatHistory.slice(-12);

            const res = await fetch("/api/ai/text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Ошибка API");

            const aiMsg = {
                role: "ai",
                text: data.result
            };

            setMessages(prev => [...prev, aiMsg]);
            addToHistory({ type: "chat", prompt: currentPrompt, data: data.result, model: selectedTextModel.name });

        } catch (err) {
            console.error("Chat Error:", err);
            setError(err.message);
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
                
                {/* Header / Top Bar */}
                <div className={styles.topBar}>
                    <button className={styles.newChatBtn} onClick={startNewChat} title="Новый чат">
                        <Plus size={18} />
                    </button>

                    <div className={styles.modelDropdownContainer}>
                        <button 
                            className={styles.modelDropdownButton}
                            onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                        >
                            <Bot size={18} color="#10b981" />
                            <span>{selectedTextModel.name}</span>
                            {isModelMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isModelMenuOpen && (
                            <div className={styles.modelDropdownMenu}>
                                {availableTextModels.map(m => {
                                    const hasVision = isMultimodal(m);
                                    return (
                                        <button 
                                            key={m.id}
                                            className={`${styles.modelOption} ${selectedTextModel.id === m.id ? styles.modelOptionActive : ''}`}
                                            onClick={() => {
                                                setSelectedTextModel(m);
                                                setIsModelMenuOpen(false);
                                            }}
                                        >
                                            <div className={styles.modelHeader}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>{m.name}</span>
                                                    {hasVision && (
                                                        <span className={styles.modelBadgeVision} title="Поддерживает зрение">
                                                            <Sparkles size={10} /> Vision
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={m.tier === 'free' ? styles.modelBadgeFree : styles.modelBadgePremium}>
                                                    {m.tier === 'free' ? 'FREE' : 'PRO'}
                                                </span>
                                            </div>
                                            <div className={styles.modelDesc}>{m.description}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className={styles.topBarRight}>
                        <button 
                            className={`${styles.settingsToggle} ${isSettingsOpen ? styles.settingsToggleActive : ''}`}
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            title="Настройки чата"
                        >
                            <SettingsIcon size={18} />
                        </button>
                    </div>

                    {isSettingsOpen && (
                        <div className={styles.settingsPanel}>
                            <div className={styles.settingsTitle}>
                                <SettingsIcon size={18} />
                                <span>Настройки чата</span>
                            </div>

                            <div className={styles.settingsGroup}>
                                <label className={styles.settingsLabel}>Режим анализа фото</label>
                                <div 
                                    className={styles.toggleContainer}
                                    onClick={() => setVisionMode(prev => prev === "dual" ? "direct" : "dual")}
                                >
                                    <div className={styles.toggleText}>
                                        <div className={styles.toggleTitle}>
                                            {visionMode === "dual" ? "Оптимизированный" : "Прямой"}
                                        </div>
                                        <div className={styles.toggleDesc}>
                                            {visionMode === "dual" 
                                                ? "Сначала Vision-модель, затем текст (дешевле)" 
                                                : "Фото напрямую в модель (выше качество)"}
                                        </div>
                                    </div>
                                    <div className={`${styles.switch} ${visionMode === "direct" ? styles.switchActive : ''}`}>
                                        <div className={styles.switchKnob}></div>
                                    </div>
                                </div>
                            </div>

                            {visionMode === "dual" && (
                                <div className={styles.settingsGroup}>
                                    <label className={styles.settingsLabel}>Vision-модель для анализа</label>
                                    <select 
                                        className={styles.visionSelect}
                                        value={selectedVisionProcessor?.id || ""}
                                        onChange={(e) => {
                                            const proc = availableVisionModels.find(m => m.id === e.target.value);
                                            if (proc) setSelectedVisionProcessor(proc);
                                        }}
                                    >
                                        {availableVisionModels.map(vm => (
                                            <option key={vm.id} value={vm.id}>
                                                {vm.name} {vm.recommended ? "⭐" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Messages List */}
                <div className={styles.chatHistory}>
                    {messages.length === 0 ? (
                        <div className={styles.emptyState}>
                            <Bot size={64} color="#10b981" style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
                            <h3>Чем я могу помочь?</h3>
                            <p>Задайте любой вопрос или отправьте изображение для анализа.<br/>Я использую новейшие модели ИИ для ответов.</p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAi}`}>
                                <div className={`${styles.avatar} ${msg.role === 'user' ? styles.avatarUser : styles.avatarAi}`}>
                                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                                </div>
                                <div className={styles.messageContent}>
                                    {msg.image && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={msg.image} alt="User upload" className={styles.attachedImage} />
                                    )}
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                                    
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
                            <div className={`${styles.avatar} ${styles.avatarAi}`}>
                                <Bot size={20} />
                            </div>
                            <div className={styles.messageContent} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#6b7280' }}>
                                <RefreshCw size={18} className={styles.spin} />
                                ИИ обрабатывает запрос...
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className={styles.inputArea}>
                    {error && (
                        <div className={styles.errorLabel}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className={styles.inputWrapper}>
                        <div className={styles.mainInputRow}>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                style={{ display: 'none' }} 
                                onChange={handleFileChange}
                                accept="image/*"
                            />
                            
                            {!imagePreview ? (
                                <button className={styles.btnAttach} onClick={() => fileInputRef.current?.click()} title="Прикрепить фото">
                                    <ImageIcon size={22} />
                                </button>
                            ) : (
                                <div className={styles.imagePreviewWrapper}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={imagePreview} alt="Preview" className={styles.imagePreviewSmall} />
                                    <button className={styles.btnRemoveSmall} onClick={clearImage}>
                                        <X size={12} />
                                    </button>
                                </div>
                            )}

                            <div className={styles.textareaContainer}>
                                <textarea
                                    ref={textareaRef}
                                    className={styles.textarea}
                                    placeholder="Спросите о чем угодно..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    rows={1}
                                />
                            </div>

                            <button 
                                className={styles.btnSend} 
                                onClick={handleSend}
                                disabled={isProcessing || (!prompt.trim() && !imageFile)}
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
