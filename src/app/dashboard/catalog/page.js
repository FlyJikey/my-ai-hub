"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, CheckCircle, Package, Send, RotateCw, RefreshCw, AlertTriangle, FileText, Database } from "lucide-react";
import styles from "./page.module.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function CatalogPage() {
    // === States ===
    const [stats, setStats] = useState({ total: 0, categories: 0, lastUpdated: null, hasData: false });
    const [view, setView] = useState("loading"); // "loading" | "upload" | "chat"
    
    // Upload States
    const [file, setFile] = useState(null);
    const [replaceData, setReplaceData] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ percent: 0, processed: 0, total: 0, error: "" });
    const fileInputRef = useRef(null);

    // Chat States
    const [chats, setChats] = useState([]);
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const chatEndRef = useRef(null);
    const textareaRef = useRef(null);

    // === On Mount ===
    useEffect(() => {
        fetchStats();
        // Load chat history
        try {
            const saved = localStorage.getItem('aiHub_catalog_chat');
            if (saved) setChats(JSON.parse(saved));
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        if (chats.length > 0) {
            localStorage.setItem('aiHub_catalog_chat', JSON.stringify(chats));
        }
    }, [chats]);

    const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(() => { scrollToBottom(); }, [chats, isGenerating]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [prompt]);

    // === API Calls ===
    const fetchStats = async () => {
        try {
            const res = await fetch("/api/catalog/stats");
            const data = await res.json();
            setStats(data);
            if (data.hasData && data.total > 0) {
                setView("chat");
            } else {
                setView("upload");
            }
        } catch (e) {
            console.error("Stats fail", e);
            setView("upload");
        }
    };

    // === Upload Handlers ===
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) setFile(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) setFile(file);
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        setUploadProgress({ percent: 0, processed: 0, total: 0, error: "" });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("replace", replaceData ? "true" : "false");

        try {
            const res = await fetch("/api/catalog/upload", {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Upload failed");
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const events = chunk.split("\n\n").filter(Boolean);

                for (const event of events) {
                    if (event.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(event.slice(6));
                            if (data.error) throw new Error(data.error);
                            if (data.done) {
                                await fetchStats(); // Re-fetch stats
                                setFile(null);
                            } else {
                                setUploadProgress({ 
                                    percent: data.percent || 0, 
                                    processed: data.processed || 0, 
                                    total: data.total || 0,
                                    error: ""
                                });
                            }
                        } catch (e) { console.error("Event parse error", e); }
                    }
                }
            }
        } catch (err) {
            setUploadProgress(prev => ({ ...prev, error: err.message }));
        } finally {
            setIsUploading(false);
        }
    };

    // === Chat Handlers ===
    const handleSend = async () => {
        if (!prompt.trim() || isGenerating) return;

        const userMsg = { role: "user", content: prompt.trim() };
        const updatedChats = [...chats, userMsg];
        setChats(updatedChats);
        const currentPrompt = prompt.trim();
        setPrompt("");
        setIsGenerating(true);

        const aiMsgIndex = updatedChats.length;
        setChats(prev => [...prev, { role: "assistant", content: "" }]);

        try {
            const res = await fetch("/api/catalog/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: currentPrompt,
                    history: chats.slice(-10), // Последние 10 сообщений
                    model: "deepseek/deepseek-chat"
                })
            });

            if (!res.ok) throw new Error("API Error");

            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullResponse = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim() === '' || line.includes(': keep-alive')) continue;
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(dataStr);
                            const content = parsed.choices?.[0]?.delta?.content || parsed.chunk || "";
                            if (content) {
                                fullResponse += content;
                                setChats(prev => {
                                    const newChats = [...prev];
                                    newChats[aiMsgIndex] = { role: "assistant", content: fullResponse };
                                    return newChats;
                                });
                            }
                        } catch (e) { /* ignore parse errors for partial chunks */ }
                    }
                }
            }
        } catch (err) {
            setChats(prev => {
                const newChats = [...prev];
                newChats[aiMsgIndex] = { role: "assistant", content: "Произошла ошибка при обращении к серверу." };
                return newChats;
            });
        } finally {
            setIsGenerating(false);
        }
    };

    // === Render ===
    if (view === "loading") {
        return (
            <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw className={styles.spin} size={32} color="#10b981" />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.headerTitle}>
                        <Package size={24} color="#10b981" /> База товаров
                        {stats.hasData && <span>{stats.total.toLocaleString("ru-RU")} позиций</span>}
                    </h1>
                    <p className={styles.headerSubtitle}>
                        {stats.hasData 
                            ? `Обновлена: ${new Date(stats.lastUpdated).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long', year: 'numeric'})}` 
                            : 'Загрузите данные для RAG (векторный поиск и общение с ИИ на базе вашего каталога)'}
                    </p>
                </div>
                {stats.hasData && view === "chat" && (
                    <button className={styles.btnUpdate} onClick={() => setView("upload")}>
                        <RotateCw size={16} /> Обновить базу
                    </button>
                )}
            </div>

            {/* View: UPLOAD */}
            {view === "upload" && (
                <div className={styles.uploadCard}>
                    <div 
                        className={styles.dropzone}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".csv,.xlsx,.xls,.json" onChange={handleFileChange} />
                        <div className={styles.dropzoneIconWrapper}>
                            {file ? <FileText size={32} color="#10b981" /> : <UploadCloud size={32} />}
                        </div>
                        {file ? (
                            <div className={styles.fileInfo}>
                                <CheckCircle size={20} /> Выбран файл: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </div>
                        ) : (
                            <>
                                <h3 className={styles.dropzoneTitle}>Перетащите файл сюда</h3>
                                <p className={styles.dropzoneDesc}>или нажмите для выбора<br/><br/>Поддерживаемые форматы: Excel (.xlsx), CSV, JSON</p>
                            </>
                        )}
                    </div>

                    <div className={styles.uploadOptions}>
                        <input 
                            type="checkbox" 
                            id="replaceData" 
                            checked={replaceData} 
                            onChange={(e) => setReplaceData(e.target.checked)} 
                            disabled={isUploading}
                        />
                        <label htmlFor="replaceData" style={{ fontSize: '0.95rem', cursor: 'pointer' }}>Заменить существующую базу товаров</label>
                    </div>

                    <button 
                        className={styles.btnUpload} 
                        onClick={handleUpload} 
                        disabled={!file || isUploading}
                    >
                        {isUploading ? <><RefreshCw size={18} className={styles.spin} /> Обработка данных...</> : <><Database size={18} /> Загрузить и обработать</>}
                    </button>

                    {isUploading && uploadProgress.total > 0 && (
                        <div className={styles.progressContainer}>
                            <div className={styles.progressHeader}>
                                <span>Извлечение и векторизация...</span>
                                <span>{uploadProgress.processed.toLocaleString("ru-RU")} / {uploadProgress.total.toLocaleString("ru-RU")}</span>
                            </div>
                            <div className={styles.progressBarTrack}>
                                <div className={styles.progressBarFill} style={{ width: `${Math.min(uploadProgress.percent, 100)}%` }}></div>
                            </div>
                            <div style={{ textAlign: 'center', marginTop: '0.5rem', color: '#10b981', fontSize: '0.85rem' }}>
                                Завершено {uploadProgress.percent}%
                            </div>
                        </div>
                    )}
                    
                    {uploadProgress.error && (
                        <div style={{ marginTop: '1rem', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <AlertTriangle size={18} /> {uploadProgress.error}
                        </div>
                    )}
                    
                    {stats.hasData && !isUploading && (
                        <div style={{ marginTop: '2rem' }}>
                            <button className={styles.btnUpdate} style={{ margin: '0 auto', background: 'transparent' }} onClick={() => setView("chat")}>
                                Вернуться к поиску по базе
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* View: CHAT */}
            {view === "chat" && (
                <div className={styles.chatContainer}>
                    <div className={styles.chatHistory}>
                        {chats.length === 0 ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', textAlign: 'center' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1.5rem', borderRadius: '50%', marginBottom: '1rem' }}>
                                    <Database size={40} color="#10b981" />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', color: '#e5e7eb', marginBottom: '0.5rem' }}>База загружена!</h3>
                                <p>Задайте любой вопрос о ваших товарах,<br/>и я найду ответ в вашем каталоге.</p>
                            </div>
                        ) : (
                            chats.map((msg, idx) => (
                                <div key={idx} className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAi}`}>
                                    <div className={`${styles.avatar} ${msg.role === 'user' ? styles.avatarUser : styles.avatarAi}`}>
                                        {msg.role === 'user' ? "Вы" : <Package size={18} />}
                                    </div>
                                    <div className={styles.messageContent}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className={styles.inputArea}>
                        <div className={styles.inputWrapper}>
                            <textarea
                                ref={textareaRef}
                                className={styles.textarea}
                                placeholder="Спросите о товарах (например: Есть ли синяя куртка XL?)"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                rows={1}
                            />
                            <button 
                                className={styles.btnSend} 
                                onClick={handleSend}
                                disabled={!prompt.trim() || isGenerating}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
