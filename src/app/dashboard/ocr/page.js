"use client";

import { useState, useRef } from "react";
import {
    Scan,
    UploadCloud,
    X,
    Copy,
    Check,
    AlertCircle,
    RefreshCw,
    Camera,
    ChevronDown,
    ChevronUp,
    Zap
} from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import styles from "./ocr.module.css";

export default function OCRPage() {
    const {
        selectedVisionModel,
        setSelectedVisionModel,
        availableVisionModels,
        addToHistory
    } = useAppContext();

    const [imagePreview, setImagePreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [result, setResult] = useState(null);
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [scanMode, setScanMode] = useState('price_tag'); // 'price_tag' or 'full'

    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith("image/")) {
                setError("Пожалуйста, выберите изображение (JPEG, PNG, WEBP).");
                return;
            }
            setError("");
            setResult(null);
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (e) => setImagePreview(e.target.result);
            reader.readAsDataURL(file);
        }
    };

    const clearImage = (e) => {
        e.stopPropagation();
        setImageFile(null);
        setImagePreview(null);
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleScan = async () => {
        if (!imageFile) return;

        setIsProcessing(true);
        setError("");

        try {
            const formData = new FormData();
            formData.append("image", imageFile);
            formData.append("provider", selectedVisionModel.provider);
            formData.append("modelId", selectedVisionModel.id);
            formData.append("mode", scanMode);

            const res = await fetch("/api/ai/vision", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Ошибка при распознавании.");

            setResult(data.result);

            // Add to history
            addToHistory({
                type: "vision",
                data: data.result,
                model: selectedVisionModel.name,
                source: "ocr-scanner"
            });

        } catch (err) {
            console.error("OCR Error:", err);
            setError(err.message || "Не удалось распознать текст. Попробуйте другое фото.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCopy = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={styles.wrapper}>
            <header className={styles.header}>
                <h1 className={styles.title}>Распознавание ценников</h1>
                <p className={styles.subtitle}>Сфотографируйте этикетку или ценник, чтобы мгновенно извлечь данные о товаре.</p>
            </header>

            <div className={styles.mainGrid}>
                {/* Scan Section */}
                <section className={styles.scanSection}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 50 }}>
                        <div className={styles.modelDropdownContainer}>
                            <button
                                className={styles.modelDropdownButton}
                                onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                                title="Выбрать нейросеть для фото"
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Zap size={14} style={{ color: '#fbbf24' }} /> ИИ: {selectedVisionModel?.name || 'Выбрать'}
                                </span>
                                {isModelMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {isModelMenuOpen && (
                                <div className={styles.modelDropdownMenu}>
                                    {availableVisionModels?.map(m => (
                                        <button
                                            key={m.key || m.id}
                                            className={`${styles.modelOption} ${selectedVisionModel?.id === m.id ? styles.modelOptionActive : ''}`}
                                            onClick={() => {
                                                setSelectedVisionModel(m);
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

                        {/* Mode Toggle Switch */}
                        <div className={styles.modeToggleContainer} style={{
                            display: 'flex',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '2rem',
                            padding: '0.25rem',
                            border: '1px solid rgba(255,255,255,0.1)',
                            pointerEvents: isProcessing ? 'none' : 'auto',
                            opacity: isProcessing ? 0.6 : 1
                        }}>
                            <button
                                className={styles.modeToggleBtn}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '2rem',
                                    fontSize: '0.875rem',
                                    fontWeight: scanMode === 'price_tag' ? 600 : 400,
                                    background: scanMode === 'price_tag' ? '#3b82f6' : 'transparent',
                                    color: scanMode === 'price_tag' ? '#fff' : '#a1a1aa',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => setScanMode('price_tag')}
                            >
                                Ценник
                            </button>
                            <button
                                className={styles.modeToggleBtn}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '2rem',
                                    fontSize: '0.875rem',
                                    fontWeight: scanMode === 'full' ? 600 : 400,
                                    background: scanMode === 'full' ? '#8b5cf6' : 'transparent',
                                    color: scanMode === 'full' ? '#fff' : '#a1a1aa',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => setScanMode('full')}
                            >
                                Всё фото
                            </button>
                        </div>
                    </div>

                    <div
                        className={`${styles.dropzone} ${imagePreview ? styles.dropzoneActive : ''}`}
                        onClick={() => !isProcessing && fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />

                        {imagePreview ? (
                            <>
                                <img src={imagePreview} alt="Target" className={styles.previewImage} />
                                <button className={styles.clearBtn} onClick={clearImage}>
                                    <X size={16} />
                                </button>
                            </>
                        ) : (
                            <div className={styles.loadingOverlay}>
                                <UploadCloud size={48} className={styles.dropzoneIcon} />
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Нажмите для загрузки или фото</p>
                                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Поддерживаются JPG, PNG, WEBP</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        className={styles.actionBtn}
                        disabled={!imageFile || isProcessing}
                        onClick={handleScan}
                    >
                        {isProcessing ? (
                            <>
                                <RefreshCw size={20} className={styles.spin} />
                                Идет распознавание...
                            </>
                        ) : (
                            <>
                                <Scan size={20} />
                                Сканировать текст
                            </>
                        )}
                    </button>

                    {error && (
                        <div className={styles.imageWarning} style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                            <AlertCircle size={18} />
                            <span style={{ fontSize: '0.875rem' }}>{error}</span>
                        </div>
                    )}
                </section>

                {/* Result Section */}
                <section className={styles.resultSection}>
                    {result ? (
                        <div className={styles.resultCard}>
                            <div className={styles.resultHeader}>
                                <h2 className={styles.resultTitle}>Результат распознавания</h2>
                                <button
                                    className={styles.copyBtn}
                                    onClick={() => handleCopy(result.productName)}
                                >
                                    {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                                    {copied ? "Скопировано" : "Копировать название"}
                                </button>
                            </div>

                            <div className={styles.resultContent}>
                                <div className={styles.attrLabel}>Название товара / Артикул</div>
                                <div className={styles.resultText}>{result.productName}</div>

                                <div className={styles.attrLabel}>Подробности</div>
                                <div style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: '#9ca3af' }}>
                                    {result.description}
                                </div>

                                {result.attributes && Object.keys(result.attributes).length > 0 && (
                                    <div className={styles.attributesGrid}>
                                        {Object.entries(result.attributes).map(([key, value]) => (
                                            <div key={key} className={styles.attrItem}>
                                                <span className={styles.attrLabel}>{key}</span>
                                                <span className={styles.attrValue}>{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className={styles.resultCard} style={{ justifyContent: 'center', alignItems: 'center', color: '#4b5563', borderStyle: 'dashed' }}>
                            <Camera size={48} opacity={0.2} style={{ marginBottom: '1rem' }} />
                            <p>Результаты появятся здесь после сканирования</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
