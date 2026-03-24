/**
 * Централизованный клиент для Polza.ai API
 * Решает проблему несогласованных доменов (polza.ai vs api.polza.ai)
 */

const POLZA_BASE_URL = process.env.POLZA_BASE_URL || 'https://polza.ai/api/v1';

/**
 * Получить API ключ Polza с очисткой от кавычек
 */
export function getPolzaKey() {
    return (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
}

/**
 * Создать эмбеддинги через Polza API
 * @param {string[]} inputs - массив текстов для векторизации
 * @param {string} model - модель эмбеддинга (по умолчанию text-embedding-3-small)
 * @returns {Promise<Object>} - ответ API с эмбеддингами
 */
export async function createEmbeddings(inputs, model = 'text-embedding-3-small') {
    const polzaKey = getPolzaKey();
    if (!polzaKey) {
        throw new Error('POLZA_API_KEY не установлен');
    }

    const response = await fetch(`${POLZA_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${polzaKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            input: inputs
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Polza embeddings API error: ${errorText}`);
    }

    return response.json();
}

/**
 * Chat completions через Polza API
 * @param {Object} params - параметры запроса
 * @param {string} params.model - ID модели
 * @param {Array} params.messages - массив сообщений
 * @param {boolean} params.stream - включить streaming
 * @param {number} params.temperature - температура генерации
 * @param {number} params.max_tokens - максимум токенов
 * @returns {Promise<Response>} - fetch Response (для streaming или JSON)
 */
export async function chatCompletions({ model, messages, stream = false, temperature = 0.7, max_tokens = 1000 }) {
    const polzaKey = getPolzaKey();
    if (!polzaKey) {
        throw new Error('POLZA_API_KEY не установлен');
    }

    const response = await fetch(`${POLZA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${polzaKey}`,
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
        throw new Error(`Polza chat API error: ${errorText}`);
    }

    return response;
}

/**
 * Получить баланс аккаунта Polza
 * @returns {Promise<Object>} - данные баланса
 */
export async function getBalance() {
    const polzaKey = getPolzaKey();
    if (!polzaKey) {
        throw new Error('POLZA_API_KEY не установлен');
    }

    const response = await fetch(`${POLZA_BASE_URL}/balance`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${polzaKey}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Polza balance API error: ${errorText}`);
    }

    return response.json();
}

/**
 * Получить список доступных моделей
 * @param {number} page - номер страницы
 * @param {number} limit - лимит на страницу
 * @returns {Promise<Object>} - список моделей
 */
export async function getModels(page = 1, limit = 100) {
    const polzaKey = getPolzaKey();
    if (!polzaKey) {
        throw new Error('POLZA_API_KEY не установлен');
    }

    const response = await fetch(`${POLZA_BASE_URL}/models/catalog?limit=${limit}&page=${page}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${polzaKey}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Polza models API error: ${errorText}`);
    }

    return response.json();
}
