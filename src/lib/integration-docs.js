export function normalizeModels(models = []) {
    return models
        .filter(model => model && model.id)
        .map(model => ({
            id: model.id,
            name: model.name || model.id,
            provider: model.provider || "unknown",
            tier: model.tier || "",
        }));
}

export function getAllowedModelIds(task, models = []) {
    const normalizedModels = normalizeModels(models);
    const allowedModels = Array.isArray(task?.allowedModels) ? task.allowedModels : [];

    if (allowedModels.includes("all")) {
        return normalizedModels.map(model => model.id);
    }

    return allowedModels.filter(Boolean);
}

export function getDefaultModelId(task, models = []) {
    return getAllowedModelIds(task, models)[0] || "";
}

export function getModelLabel(modelId, models = []) {
    if (!modelId) return "";
    const model = normalizeModels(models).find(item => item.id === modelId);
    if (!model) return modelId;
    return `${model.name} (${model.provider})`;
}

export function buildTaskModelSummary(task, models = []) {
    const allowedModels = Array.isArray(task?.allowedModels) ? task.allowedModels : [];
    const modelIds = getAllowedModelIds(task, models);

    if (!modelIds.length) return "модели не выбраны";
    if (allowedModels.includes("all")) return `все модели (${modelIds.length})`;

    return modelIds.map(modelId => getModelLabel(modelId, models)).join(", ");
}

export function buildRequestBodyExample(task, models = []) {
    const defaultModel = getDefaultModelId(task, models);
    const lines = [
        "{",
        `  "task": "${task?.id || "worker"}",`,
        `  "prompt": "Текст запроса"${defaultModel ? "," : ""}`,
    ];

    if (defaultModel) {
        lines.push(`  "model": "${defaultModel}"`);
    }

    lines.push("}");
    return lines.join("\n");
}

export function buildResponseExample(task, models = []) {
    const defaultModel = getDefaultModelId(task, models);
    return JSON.stringify({
        status: "ok",
        answer: "Ответ модели...",
        model_used: defaultModel || "model-id",
    }, null, 2);
}

export function buildRequestExample({ siteUrl, apiKey, task, models = [] }) {
    return `curl -X POST ${siteUrl}/api/integrations/chat \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${buildRequestBodyExample(task, models)}'`;
}

export function buildModelList(models = []) {
    return normalizeModels(models)
        .map(model => `${model.id.padEnd(48)} ${model.provider}`)
        .join("\n");
}

export function buildAiSetupPrompt({ siteUrl, apiKey, integration, models = [] }) {
    const tasks = Array.isArray(integration?.tasks) ? integration.tasks : [];
    const taskDocs = tasks.length
        ? tasks.map(task => {
            const modelIds = getAllowedModelIds(task, models);
            const defaultModel = getDefaultModelId(task, models);
            return [
                `Задача: ${task.id}`,
                `Разрешенные модели: ${buildTaskModelSummary(task, models)}`,
                defaultModel ? `Модель по умолчанию для примеров: ${defaultModel}` : "Модель по умолчанию не задана",
                "Пример тела JSON:",
                buildRequestBodyExample(task, models),
            ].join("\n");
        }).join("\n\n")
        : "Задачи не настроены. Сначала нужно добавить задачу и выбрать разрешенные модели.";

    return `Ты ИИ-агент для настройки внешней интеграции с AI Hub. Используй только данные ниже, не придумывай endpoint, ключи, задачи, модели или параметры.

Цель:
1. Разобраться по этой документации, как отправлять запросы в AI Hub.
2. Настроить внешнее приложение/скрипт/бота на работу через API.
3. Если чего-то не хватает, явно скажи что именно нужно добавить в настройках интеграции.
4. После настройки проверь запрос тестовым вызовом и покажи результат.

API:
Endpoint: ${siteUrl}/api/integrations/chat
Метод: POST
Заголовки:
Authorization: Bearer ${apiKey}
Content-Type: application/json

Обязательные поля тела JSON:
task — ID задачи
prompt — текст запроса

Опциональное поле:
model — ID модели. Если model не передан, AI Hub выберет первую разрешенную модель задачи.

Интеграция:
Название: ${integration?.name || "Без названия"}
API ключ: ${apiKey}

Задачи и модели:
${taskDocs}

Формат успешного ответа:
${buildResponseExample(tasks[0] || { id: "task", allowedModels: [] }, models)}

Коды ошибок:
401 — неверный или отсутствующий API ключ
403 — задача не настроена или модель не разрешена
400 — отсутствуют обязательные параметры
500 — внутренняя ошибка сервера

Сделай настройку в авторежиме на основе этих фактов.`;
}
