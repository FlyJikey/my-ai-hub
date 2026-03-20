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
    AlertCircle 
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
    const [copiedIndex, setCopiedIndex] = useState(null);

    // Image handling
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Load messages from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('aiHub_standalone_chat');
            if (saved) setMessages(JSON.parse(saved));
        } catch (e) {
            console.error("Failed to load standalone chat", e);
        }
    }, []);

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

    const handleSend = async () => {
        if (!prompt.trim() && !imageFile) return;
        
        const isVisionSupported = selectedTextModel.id.includes('gpt-4o') || 
                                 selectedTextModel.id.includes('claude-3') || 
                                 selectedTextModel.id.includes('gemini') ||
                                 selectedTextModel.modelType === 'vision';

        if (imageFile && !isVisionSupported) {
             // Fallback to specific vision model if current text model doesn't support images directly in chat?
             // For simplicity in "standalone chat", we'll check if the text model supports it or use the selected vision model.
             // But usually in a simple chat, users expect the current model to handle it.
             // If not, we'll suggest switching.
             setError("Эта модель может не поддерживать изображения. Попробуйте GPT-4o или Claude 3.");
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
        
        setPrompt("");
        clearImage();

        try {
            let contextResult = null;
            
            // 1. If image, process with Vision first (or as part of multimodal if the API supports it)
            // Our current /api/ai/text supports chatHistory which is good for text.
            // Our current /api/ai/vision is for structured extraction.
            // For a "general chat", we'll use the Vision API to get a description if the model is text-only,
            // or pass the image if supported.
            
            if (currentImageFile) {
                const formData = new FormData();
                formData.append("image", currentImageFile);
                formData.append("provider", selectedVisionModel.provider);
                formData.append("modelId", selectedVisionModel.id);

                const visRes = await fetch("/api/ai/vision", {
                    method: "POST",
                    body: formData
                });
                const visData = await visRes.json();
                if (visRes.ok) contextResult = visData.result;
            }

            // 2. Prepare prompt with context if image was processed
            let finalPrompt = currentPrompt;
            if (contextResult) {
                const characteristics = Object.entries(contextResult.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
                finalPrompt = `[Контекст изображения: ${contextResult.description || 'Изображение товара'}. Характеристики: ${characteristics}]\n\nПользователь: ${currentPrompt}`;
            }

            // 3. Chat completion
            const chatHistory = [
                { role: "system", content: "You are a helpful AI assistant in the AI HUB dashboard. You can help with text generation, analysis, and general questions. Always respond in Russian unless asked otherwise." },
                ...messages.map(m => ({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.text
                })),
                { role: "user", content: finalPrompt }
            ];

            const res = await fetch("/api/ai/text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: finalPrompt,
                    provider: selectedTextModel.provider,
                    modelId: selectedTextModel.id,
                    chatHistory: chatHistory.slice(-10) // Last 10 messages for context
                })
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
            setError(err.message);
            // Optionally remove the last user message if it failed?
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
                                {availableTextModels.map(m => (
                                    <button 
                                        key={m.id}
                                        className={`${styles.modelOption} ${selectedTextModel.id === m.id ? styles.modelOptionActive : ''}`}
                                        onClick={() => {
                                            setSelectedTextModel(m);
                                            setIsModelMenuOpen(false);
                                        }}
                                    >
                                        <div className={styles.modelHeader}>
                                            <span>{m.name}</span>
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

                    <div style={{ width: 36 }}></div> {/* Spacer */}
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
