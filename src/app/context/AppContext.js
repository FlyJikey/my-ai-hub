"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { AI_MODELS } from "../../config/models";

const AppContext = createContext();

export function AppProvider({ children }) {
    // Global State
    const [visionData, setVisionData] = useState(null);
    const [visionImagePreview, setVisionImagePreview] = useState(null);

    // Store the full model objects
    const [availableTextModels, setAvailableTextModels] = useState([]);
    const [availableVisionModels, setAvailableVisionModels] = useState([]);
    const [availableScenarios, setAvailableScenarios] = useState([]);

    const [selectedTextModel, setSelectedTextModel] = useState(AI_MODELS.text[0]);
    const [selectedVisionModel, setSelectedVisionModel] = useState(AI_MODELS.vision[0]);

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    const txt = (data.textModels || []).filter(m => m.enabled !== false);
                    const vis = (data.visionModels || []).filter(m => m.enabled !== false);
                    const sc = (data.scenarios || []).filter(s => s.enabled !== false);
                    setAvailableTextModels(txt);
                    setAvailableVisionModels(vis);
                    setAvailableScenarios(sc);
                    if (txt.length > 0) setSelectedTextModel(txt[0]);
                    if (vis.length > 0) setSelectedVisionModel(vis[0]);
                }
            })
            .catch(err => console.error('Failed to load global settings', err));
    }, []);

    // History State
    const [history, setHistory] = useState(() => {
        if (typeof window === "undefined") {
            return [];
        }

        try {
            const savedHistory = localStorage.getItem("aiHubHistory");
            return savedHistory ? JSON.parse(savedHistory) : [];
        } catch (e) {
            console.error("Failed to load history", e);
            return [];
        }
    });
    const [analysisLogs, setAnalysisLogs] = useState([]);

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
            availableTextModels,
            availableVisionModels,
            availableScenarios,
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
