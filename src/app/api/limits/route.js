import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req) {
    try {
        // 1. Опционально: проверить авторизацию, если есть сессия.
        // Сейчас просто берем публичные включенные модели из глобальных настроек.

        const { data: settingsData, error } = await supabase
            .from('ai_settings')
            .select('*')
            .eq('id', 'global')
            .single();

        if (error || !settingsData) {
            return NextResponse.json({ error: "Не удалось загрузить настройки моделей" }, { status: 500 });
        }

        const textModels = settingsData.data.textModels || [];
        const visionModels = settingsData.data.visionModels || [];

        // Собираем всех уникальных провайдеров из ВКЛЮЧЕННЫХ моделей
        const enabledProviders = new Set();

        [...textModels, ...visionModels].forEach(model => {
            if (model.enabled !== false) {
                let provider = model.provider;
                if (!provider && model.id) {
                    // Fallback check
                    if (model.id.includes('polza') || model.id.includes('gpt') || model.id.startsWith('deepseek')) provider = 'polza';
                    else provider = 'openrouter';
                }
                if (provider) enabledProviders.add(provider);
            }
        });

        const limitsData = {
            polza: { status: 'unused', balance: null, raw: null },
            openrouter: { status: 'unused', balance: null, raw: null },
            groq: { status: 'unused', balance: 'Не тарифицируется', raw: null },
            gemini: { status: 'unused', balance: 'Свободный доступ/Limit', raw: null },
            omniroute: { status: 'unused', balance: null, raw: null }
        };

        // 2. Fetch from Polza.ai if enabled
        if (enabledProviders.has('polza')) {
            const polzaKey = process.env.POLZA_API_KEY;
            if (polzaKey) {
                try {
                    // Используем правильный эндпоинт Polza для баланса
                    // Если у Polza нет публичного /v1/users/me в совместимом API, мы попытаемся
                    // Мы используем /v1/users/me или аналогичный. Если он упадет, вернем 'active'.
                    const pRes = await fetch("https://polza.ai/api/v1/balance", {
                        headers: { "Authorization": `Bearer ${polzaKey.trim()}` }
                    });

                    if (pRes.ok) {
                        const pData = await pRes.json();
                        limitsData.polza = {
                            status: 'active',
                            balance: `${pData.amount} ₽` || 'Активен',
                            raw: pData
                        };
                    } else {
                        // Если эндпоинт '/me' не поддерживается, просто пишем что ключ есть
                        limitsData.polza = { status: 'active', balance: 'Ключ установлен (баланс скрыт)', raw: null };
                    }
                } catch (e) {
                    limitsData.polza = { status: 'error', balance: 'Ошибка проверки', error: e.message };
                }
            } else {
                limitsData.polza = { status: 'missing_key', balance: 'Ключ не настроен' };
            }
        }

        // 3. Fetch from OpenRouter if enabled
        if (enabledProviders.has('openrouter')) {
            const orKey = process.env.OPENROUTER_API_KEY;
            if (orKey) {
                try {
                    const orRes = await fetch("https://openrouter.ai/api/v1/credits", {
                        headers: { "Authorization": `Bearer ${orKey.trim()}` }
                    });

                    if (orRes.ok) {
                        const orData = await orRes.json();
                        limitsData.openrouter = {
                            status: 'active',
                            balance: orData.data?.total_credits ? `$${orData.data.total_credits.toFixed(4)}` : 'Активен',
                            raw: orData.data
                        };
                    } else {
                        // Альтернативный эндпоинт
                        const authRes = await fetch("https://openrouter.ai/api/v1/auth/key", {
                            headers: { "Authorization": `Bearer ${orKey.trim()}` }
                        });
                        if (authRes.ok) {
                            const authData = await authRes.json();
                            limitsData.openrouter = {
                                status: 'active',
                                balance: authData.data?.limit ? `Лимит: $${authData.data.limit}` : 'Активен',
                                raw: authData.data
                            };
                        } else {
                            limitsData.openrouter = { status: 'active', balance: 'Ключ установлен', raw: null };
                        }
                    }
                } catch (e) {
                    limitsData.openrouter = { status: 'error', balance: 'Ошибка проверки', error: e.message };
                }
            } else {
                limitsData.openrouter = { status: 'missing_key', balance: 'Ключ не настроен' };
            }
        }

        // 4. Groq (Usually API key just works or rate limits, no native balance API commonly used in standard tier)
        if (enabledProviders.has('groq')) {
            const groqKey = process.env.GROQ_API_KEY;
            limitsData.groq = {
                status: groqKey ? 'active' : 'missing_key',
                balance: groqKey ? 'Активен (Смотрите лимиты в консоли Groq)' : 'Ключ не настроен'
            };
        }

        // 5. OmniRoute
        if (enabledProviders.has('omniroute')) {
            const omnirouteKey = process.env.OMNIROUTE_API_KEY;
            if (omnirouteKey) {
                try {
                    // OmniRoute использует OpenAI-совместимый API, проверяем доступность моделей
                    const orRes = await fetch("http://89.208.14.46:20128/v1/models", {
                        headers: { "Authorization": `Bearer ${omnirouteKey.trim()}` }
                    });

                    if (orRes.ok) {
                        const orData = await orRes.json();
                        limitsData.omniroute = {
                            status: 'active',
                            balance: `Доступно моделей: ${orData.data?.length || 0}`,
                            raw: orData
                        };
                    } else {
                        limitsData.omniroute = { status: 'error', balance: 'Ошибка доступа', raw: null };
                    }
                } catch (e) {
                    limitsData.omniroute = { status: 'error', balance: 'Ошибка проверки', error: e.message };
                }
            } else {
                limitsData.omniroute = { status: 'missing_key', balance: 'Ключ не настроен' };
            }
        }

        return NextResponse.json({
            success: true,
            providers: limitsData
        });

    } catch (error) {
        console.error("Limits fetch error:", error);
        return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
    }
}
