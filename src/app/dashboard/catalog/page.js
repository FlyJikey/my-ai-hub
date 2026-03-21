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
    const abortControllerRef = useRef(null);

    // === On Mount ===
    useEffect(() => {
        fetchStats();
    }, []);

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
        
        // Setup AbortController
        abortControllerRef.current = new AbortController();

        const formData = new FormData();
        formData.append("file", file);
        formData.append("replace", replaceData ? "true" : "false");

        try {
            const res = await fetch("/api/catalog/upload", {
                method: "POST",
                body: formData,
                signal: abortControllerRef.current.signal
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

    const handleStopUpload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsUploading(false);
            setUploadProgress(prev => ({ ...prev, error: "Загрузка остановлена пользователем" }));
        }
    };

    // Chat Handlers (REMOVED - now integrated in main chat)

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
                    
                    {!isUploading && (
                        <div style={{ marginTop: '2rem' }}>
                            <button className={styles.btnUpdate} style={{ margin: '0 auto', background: 'transparent' }} onClick={() => fetchStats()}>
                                Обновить статистику
                            </button>
                        </div>
                    )}

                    {isUploading && (
                        <button className={styles.btnStop} onClick={handleStopUpload} style={{ marginTop: '1.5rem' }}>
                            Остановить загрузку
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
