/**
 * Централизованный клиент для OmniRoute API
 * OmniRoute - AI Gateway для мульти-провайдерных LLM
 */

const OMNIROUTE_BASE_URL = process.env.OMNIROUTE_BASE_URL || 'http://89.208.14.46:20128/v1';

/**
 * Получить API ключ OmniRoute с очисткой от кавычек
 */
export function getOmniRouteKey() {
    return (process.env.OMNIROUTE_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
}

/**
 * Создать эмбеддинги через OmniRoute API
 * @param {string[]} inputs - массив текстов для векторизации
 * @param {string} model - модель эмбеддинга
 * @returns {Promise<Object>} - ответ API с эмбеддингами
 */
export async function createEmbeddings(inputs, model = 'text-embedding-3-small') {
    const apiKey = getOmniRouteKey();
    if (!apiKey) {
        throw new Error('OMNIROUTE_API_KEY не установлен');
    }

    const response = await fetch(`${OMNIROUTE_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            input: inputs
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OmniRoute embeddings API error: ${errorText}`);
    }

    return response.json();
}

/**
 * Chat completions через OmniRoute API
 * @param {Object} params - параметры запроса
 * @param {string} params.model - ID модели
 * @param {Array} params.messages - массив сообщений
 * @param {boolean} params.stream - включить streaming
 * @param {number} params.temperature - температура генерации
 * @param {number} params.max_tokens - максимум токенов
 * @returns {Promise<Response>} - fetch Response (для streaming или JSON)
 */
export async function chatCompletions({ model, messages, stream = false, temperature = 0.7, max_tokens = 1000 }) {
    const apiKey = getOmniRouteKey();
    if (!apiKey) {
        throw new Error('OMNIROUTE_API_KEY не установлен');
    }

    const response = await fetch(`${OMNIROUTE_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            messages,
            stream,
            temperature,
            max_tokens
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OmniRoute chat API error: ${errorText}`);
    }

    return response;
}

/**
 * Получить список доступных моделей
 * @returns {Promise<Object>} - список моделей
 */
export async function getModels() {
    const apiKey = getOmniRouteKey();
    if (!apiKey) {
        throw new Error('OMNIROUTE_API_KEY не установлен');
    }

    const response = await fetch(`${OMNIROUTE_BASE_URL}/models`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OmniRoute models API error: ${errorText}`);
    }

    return response.json();
}
