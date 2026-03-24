/**
 * Простая авторизация для защиты admin-endpoints
 * Использует API_SECRET_KEY из env для проверки Bearer токена
 */

/**
 * Проверить авторизацию запроса
 * @param {Request} request - Next.js Request объект
 * @returns {Object} { authorized: boolean, error?: string }
 */
export function checkAuth(request) {
    const apiSecretKey = process.env.API_SECRET_KEY;
    
    // Если ключ не настроен - пропускаем (backward compatibility)
    // В production рекомендуется всегда устанавливать API_SECRET_KEY
    if (!apiSecretKey) {
        console.warn('API_SECRET_KEY не установлен - admin endpoints доступны без авторизации');
        return { authorized: true };
    }

    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
        return { 
            authorized: false, 
            error: 'Требуется авторизация. Добавьте заголовок Authorization: Bearer <token>' 
        };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    
    if (token !== apiSecretKey) {
        return { 
            authorized: false, 
            error: 'Неверный токен авторизации' 
        };
    }

    return { authorized: true };
}

/**
 * Middleware для защиты endpoint'а
 * Использовать в начале POST/DELETE/PUT handlers
 * 
 * @example
 * export async function POST(req) {
 *   const authResult = requireAuth(req);
 *   if (!authResult.authorized) {
 *     return NextResponse.json({ error: authResult.error }, { status: 401 });
 *   }
 *   // ... остальная логика
 * }
 */
export function requireAuth(request) {
    return checkAuth(request);
}
