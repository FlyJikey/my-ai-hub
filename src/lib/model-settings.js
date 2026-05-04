import { AI_MODELS } from "../config/models.js";

export function mergeConfiguredModels(savedModels = [], defaultModels = []) {
    const source = Array.isArray(savedModels) && savedModels.length ? savedModels : defaultModels;

    return source
        .filter(model => model && model.id)
        .map(model => {
            const defaultModel = defaultModels.find(item => item.id === model.id);
            return defaultModel ? { ...defaultModel, ...model } : model;
        });
}

export function getEnabledTextModels(settings = {}, defaultModels = AI_MODELS.text) {
    return mergeConfiguredModels(settings?.textModels, defaultModels)
        .filter(model => model.enabled !== false);
}

export function syncAllowedModelsWithAvailable(allowedModels = [], availableModels = []) {
    if (!Array.isArray(allowedModels)) return [];
    if (allowedModels.includes("all")) return ["all"];

    const availableIds = new Set(availableModels.map(model => model.id));
    return allowedModels.filter(modelId => availableIds.has(modelId));
}

export function syncIntegrationTasksWithModels(integration, availableModels = []) {
    if (!integration || !Array.isArray(integration.tasks)) return integration;

    return {
        ...integration,
        tasks: integration.tasks.map(task => ({
            ...task,
            allowedModels: syncAllowedModelsWithAvailable(task.allowedModels, availableModels),
        })),
    };
}
