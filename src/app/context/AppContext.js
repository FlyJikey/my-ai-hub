"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { AI_MODELS } from "../../config/models";

const AppContext = createContext();

export function AppProvider({ children }) {
    // Global State
    const [visionData, setVisionData] = useState(null);
    const [visionImagePreview, setVisionImagePreview] = useState(null);

    // Store the full model objects
    const [selectedTextModel, setSelectedTextModel] = useState(AI_MODELS.text[0]);
    const [selectedVisionModel, setSelectedVisionModel] = useState(AI_MODELS.vision[0]);

    // History State
    const [history, setHistory] = useState([]);
    const [analysisLogs, setAnalysisLogs] = useState([]);

    // Load history on mount
    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem("aiHubHistory");
            if (savedHistory) {
                setHistory(JSON.parse(savedHistory));
            }
        } catch (e) {
            console.error("Failed to load history", e);
        }
    }, []);

    // Save specific generation to history
    const addToHistory = (item) => {
        const newItem = {
            ...item,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
        };

        setHistory(prev => {
            const updated = [newItem, ...prev].slice(0, 100); // Keep last 100 items
            localStorage.setItem("aiHubHistory", JSON.stringify(updated));
            return updated;
        });
    };

    // Stats Derived from History
    const stats = {
        totalGenerations: history.length,
        visionUsed: history.filter(h => h.type === "vision").length,
        textUsed: history.filter(h => h.type === "text").length,
    };

    const addAnalysisLog = (log) => {
        setAnalysisLogs(prev => [{ ...log, id: Date.now().toString(), timestamp: new Date().toISOString() }, ...prev].slice(0, 50));
    };

    return (
        <AppContext.Provider value={{
            visionData,
            setVisionData,
            visionImagePreview,
            setVisionImagePreview,
            selectedTextModel,
            setSelectedTextModel,
            selectedVisionModel,
            setSelectedVisionModel,
            history,
            addToHistory,
            stats,
            analysisLogs,
            addAnalysisLog
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used within an AppProvider");
    }
    return context;
}
