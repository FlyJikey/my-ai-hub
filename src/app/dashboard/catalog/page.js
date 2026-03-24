"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { UploadCloud, CheckCircle, Package, Send, RotateCw, RefreshCw, AlertTriangle, FileText, Database, MessageSquare } from "lucide-react";
import styles from "./page.module.css";

export default function CatalogPage() {
    // === States ===
    const [stats, setStats] = useState({ total: 0, vectorized: 0, categories: 0, lastUpdated: null, hasData: false });
    const [view, setView] = useState("loading"); // "loading" | "upload" | "chat"
    
    // Upload States
    const [file, setFile] = useState(null);
    const [replaceData, setReplaceData] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ percent: 0, processed: 0, total: 0, error: "" });
    const fileInputRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Vectorize States
    const [isVectorizing, setIsVectorizing] = useState(false);
    const [vectorizeProgress, setVectorizeProgress] = useState({ percent: 0, processed: 0, total: 0, error: "" });
    const abortControllerVectorizeRef = useRef(null);

    // === On Mount ===
    useEffect(() => {
        fetchStats();
    }, []);

    const getAdminToken = () => {
        if (typeof window === "undefined") {
            return "";
        }

        return localStorage.getItem("aiHubApiSecret") || "";
    };

    const fetchWithAdminAuth = async (url, options = {}) => {
        const makeRequest = (token = "") => {
            const headers = new Headers(options.headers || {});
            if (token) {
                headers.set("Authorization", `Bearer ${token}`);
            }

            return fetch(url, {
                ...options,
                headers
            });
        };

        let token = getAdminToken();
        let response = await makeRequest(token);

        if (response.status !== 401 || typeof window === "undefined") {
            return response;
        }

        const promptedToken = window.prompt("Введите API_SECRET_KEY для доступа к управлению каталогом:", token);
        if (!promptedToken) {
            return response;
        }

        localStorage.setItem("aiHubApiSecret", promptedToken);
        return makeRequest(promptedToken);
    };

    const readSseStream = async (response, onData) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const event of events) {
                const payload = event
                    .split("\n")
                    .filter((line) => line.startsWith("data: "))
                    .map((line) => line.slice(6))
                    .join("");

                if (!payload) {
                    continue;
                }

                await onData(JSON.parse(payload));
            }
        }

        const finalPayload = buffer
            .split("\n")
            .filter((line) => line.startsWith("data: "))
            .map((line) => line.slice(6))
            .join("");

        if (finalPayload) {
            await onData(JSON.parse(finalPayload));
        }
    };

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
            const res = await fetchWithAdminAuth("/api/catalog/upload", {
                method: "POST",
                body: formData,
                signal: abortControllerRef.current.signal
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Upload failed");
            }

            await readSseStream(res, async (data) => {
                if (data.error) {
                    throw new Error(data.error);
                }

                if (data.done) {
                    await fetchStats();
                    setFile(null);
                    return;
                }

                setUploadProgress({
                    percent: data.percent || 0,
                    processed: data.processed || 0,
                    total: data.total || 0,
                    error: ""
                });
            });
        } catch (err) {
            setUploadProgress(prev => ({ ...prev, error: err.message }));
        } finally {
            setIsUploading(false);
            if (!abortControllerRef.current?.signal.aborted) {
                fetchStats();
            }
        }
    };

    const handleStopUpload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsUploading(false);
            setUploadProgress(prev => ({ ...prev, error: "Загрузка остановлена пользователем" }));
        }
    };

    // === Vectorize Handlers ===
    const handleVectorize = async () => {
        setIsVectorizing(true);
        setVectorizeProgress({ percent: 0, processed: 0, total: 0, error: "" });
        abortControllerVectorizeRef.current = new AbortController();

        try {
            const res = await fetchWithAdminAuth("/api/catalog/vectorize", {
                method: "POST",
                signal: abortControllerVectorizeRef.current.signal
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Ошибка старта векторизации");
            }

            await readSseStream(res, async (data) => {
                if (data.error) {
                    setVectorizeProgress(prev => ({ ...prev, error: data.error }));
                    return;
                }

                if (data.done) {
                    await fetchStats();
                    setVectorizeProgress(prev => ({
                        ...prev,
                        percent: 100,
                        processed: data.processed ?? prev.processed,
                        total: data.total ?? prev.total
                    }));
                    return;
                }

                setVectorizeProgress({
                    percent: data.percent || 0,
                    processed: data.processed || 0,
                    total: data.total || 0,
                    error: data.failed ? `Пропущено товаров: ${data.failed}` : ""
                });
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                setVectorizeProgress(prev => ({ ...prev, error: err.message }));
            }
        } finally {
            setIsVectorizing(false);
            if (!abortControllerVectorizeRef.current?.signal.aborted) {
                fetchStats();
            }
        }
    };

    const handleStopVectorize = () => {
        if (abortControllerVectorizeRef.current) {
            abortControllerVectorizeRef.current.abort();
            setIsVectorizing(false);
            setVectorizeProgress(prev => ({ ...prev, error: "Векторизация остановлена пользователем" }));
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
                            ? `Векторизовано: ${stats.vectorized?.toLocaleString("ru-RU") || 0} / ${stats.total.toLocaleString("ru-RU")} | Обновлена: ${new Date(stats.lastUpdated).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long', year: 'numeric'})}` 
                            : 'Загрузите данные для RAG (векторный поиск и общение с ИИ на базе вашего каталога)'}
                    </p>
                </div>
                {stats.hasData && view === "chat" && (
                    <button className={styles.btnUpdate} onClick={() => setView("upload")}>
                        <RotateCw size={16} /> Обновить базу
                    </button>
                )}
            </div>

            {view === "chat" && (
                <div className={styles.uploadCard}>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{ padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.18)', background: 'rgba(16, 185, 129, 0.05)' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '1.1rem' }}>
                                <Database size={20} color="#10b981" /> Каталог подключен
                            </h3>
                            <p style={{ margin: '0.75rem 0 0', color: '#a1a1aa', lineHeight: 1.6 }}>
                                База товаров загружена и доступна для поиска. Для вопросов по каталогу используйте переключатель базы в `Чат ИИ`.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                                <Link href="/dashboard/chat" className={styles.btnUpload} style={{ textDecoration: 'none', justifyContent: 'center' }}>
                                    <MessageSquare size={18} /> Открыть Чат ИИ
                                </Link>
                                <button className={styles.btnUpdate} onClick={() => setView("upload")}> 
                                    <RotateCw size={16} /> Обновить базу
                                </button>
                                <button className={styles.btnUpdate} onClick={() => fetchStats()}>
                                    Обновить статистику
                                </button>
                            </div>
                        </div>

                        {stats.total > stats.vectorized && (
                            <div style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <h3 style={{ color: '#10b981', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Требуется векторизация</h3>
                                <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                    В базе есть {stats.total - stats.vectorized} товаров без векторов. Они не будут доступны для поиска ИИ, пока вы их не векторизуете.
                                </p>
                                <button className={styles.btnUpload} onClick={handleVectorize} disabled={isVectorizing || isUploading}>
                                    {isVectorizing ? <><RefreshCw size={18} className={styles.spin} /> Идет векторизация...</> : <><Send size={18} /> Векторизовать ИИ</>}
                                </button>

                                {isVectorizing && vectorizeProgress.total > 0 && (
                                    <div className={styles.progressContainer} style={{ marginTop: '1rem' }}>
                                        <div className={styles.progressHeader}>
                                            <span>Генерация векторов (Polza.ai)...</span>
                                            <span>{vectorizeProgress.processed.toLocaleString("ru-RU")} / {vectorizeProgress.total.toLocaleString("ru-RU")}</span>
                                        </div>
                                        <div className={styles.progressBarTrack}>
                                            <div className={styles.progressBarFill} style={{ width: `${Math.min(vectorizeProgress.percent, 100)}%` }}></div>
                                        </div>
                                        {vectorizeProgress.error && (
                                            <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 'bold' }}>
                                                {vectorizeProgress.error}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isVectorizing && (
                                    <button className={styles.btnStop} onClick={handleStopVectorize} style={{ marginTop: '1rem', width: '100%' }}>
                                        Остановить векторизацию
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                        disabled={!file || isUploading || isVectorizing}
                    >
                        {isUploading ? <><RefreshCw size={18} className={styles.spin} /> Обработка данных...</> : <><Database size={18} /> Загрузить в базу</>}
                    </button>

                    {/* Vectorization Block */}
                    {stats.hasData && stats.total > stats.vectorized && !isUploading && (
                        <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <h3 style={{ color: '#10b981', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Требуется векторизация</h3>
                            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                В базе есть {stats.total - stats.vectorized} товаров без векторов. Они не будут доступны для поиска ИИ, пока вы их не векторизуете.
                            </p>
                            <button 
                                className={styles.btnUpload} 
                                onClick={handleVectorize} 
                                disabled={isVectorizing || isUploading}
                            >
                                {isVectorizing ? <><RefreshCw size={18} className={styles.spin} /> Идет векторизация...</> : <><Send size={18} /> Векторизовать ИИ</>}
                            </button>
                            
                            {isVectorizing && vectorizeProgress.total > 0 && (
                                <div className={styles.progressContainer} style={{ marginTop: '1rem' }}>
                                    <div className={styles.progressHeader}>
                                        <span>Генерация векторов (Polza.ai)...</span>
                                        <span>{vectorizeProgress.processed.toLocaleString("ru-RU")} / {vectorizeProgress.total.toLocaleString("ru-RU")}</span>
                                    </div>
                                    <div className={styles.progressBarTrack}>
                                        <div className={styles.progressBarFill} style={{ width: `${Math.min(vectorizeProgress.percent, 100)}%` }}></div>
                                    </div>
                                    {vectorizeProgress.error && (
                                        <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 'bold' }}>
                                            {vectorizeProgress.error}
                                        </div>
                                    )}
                                </div>
                            )}

                            {isVectorizing && (
                                <button className={styles.btnStop} onClick={handleStopVectorize} style={{ marginTop: '1rem', width: '100%' }}>
                                    Остановить векторизацию
                                </button>
                            )}
                        </div>
                    )}

                    {isUploading && uploadProgress.total > 0 && (
                        <div className={styles.progressContainer}>
                            <div className={styles.progressHeader}>
                                <span>Сохранение в базу данных...</span>
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
