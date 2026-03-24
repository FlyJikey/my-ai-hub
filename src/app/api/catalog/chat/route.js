import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req) {
    try {
        const body = await req.json();
        const message = body.message || "";
        const history = body.history || [];
        const model = body.model || "deepseek/deepseek-chat";
        const embeddingModel = body.embeddingModel || "text-embedding-3-small";
        const embeddingProvider = body.embeddingProvider || "polza";

        if (!message.trim()) {
            return NextResponse.json({ error: "Пустое сообщение" }, { status: 400, headers: corsHeaders });
        }

        console.log(`[CATALOG CHAT] Запрос: "${message}", модель embedding: ${embeddingModel} (${embeddingProvider})`);

        // Получаем API ключ в зависимости от провайдера
        let apiKey, apiUrl;
        
        if (embeddingProvider === "polza") {
            apiKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            apiUrl = "https://polza.ai/api/v1/embeddings";
            if (!apiKey) {
                return NextResponse.json({ error: "Ключ POLZA_API_KEY не установлен" }, { status: 500, headers: corsHeaders });
            }
        } else if (embeddingProvider === "openrouter") {
            apiKey = (process.env.OPENROUTER_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            apiUrl = "https://openrouter.ai/api/v1/embeddings";
            if (!apiKey) {
                return NextResponse.json({ error: "Ключ OPENROUTER_API_KEY не установлен" }, { status: 500, headers: corsHeaders });
            }
        } else {
            return NextResponse.json({ error: `Неподдерживаемый провайдер: ${embeddingProvider}` }, { status: 400, headers: corsHeaders });
        }

        // 1. Внутренний поиск топ-20 товаров (генерация эмбеддинга для вопроса)
        const embedRes = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: embeddingModel,
                input: [message]
            })
        });

        let productsContext = "Нет найденных товаров.";
        
        if (embedRes.ok) {
            const embedData = await embedRes.json();
            const queryEmbedding = embedData.data[0].embedding;

            console.log(`[CATALOG CHAT] Embedding создан, размерность: ${queryEmbedding.length}`);

            const { data: products, error: rpcError } = await supabase.rpc('match_products', {
                query_embedding: queryEmbedding,
                match_count: 20,
                match_offset: 0
            });

            if (rpcError) {
                console.error('[CATALOG CHAT] Ошибка RPC match_products:', rpcError);
                productsContext = "Ошибка поиска товаров в базе данных.";
            } else if (products && products.length > 0) {
                console.log(`[CATALOG CHAT] Найдено товаров: ${products.length}`);
                productsContext = products.map((p, i) => {
                    let attrStr = "";
                    if (p.attributes) {
                        attrStr = Object.entries(p.attributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ');
                    }
                    return `${i + 1}. [Арт: ${p.sku || 'N/A'}] ${p.name || 'Без названия'} | Категория: ${p.category || 'N/A'} | Цена: ${p.price || 0}₽` + (attrStr ? ` | ${attrStr}` : '');
                }).join("\n");
            } else {
                console.log('[CATALOG CHAT] Товары не найдены');
            }
        } else {
            console.error("Search embedding in chat failed", await embedRes.text());
        }

        // 2. Формирование системного промпта
        const systemPrompt = `Ты профессиональный AI-консультант по каталогу товаров интернет-магазина.
Отвечай ТОЛЬКО на основе данных из базы товаров ниже.
Если подходящий товар не найден в базе — честно скажи об этом, не придумывай товары от себя.
Обязательно указывай артикул товара в ответе для удобства поиска.
Всегда отвечай на русском языке, будь вежлив и краток. Консультируй как лучший продавец.

База товаров (найдены релевантные совпадения):
${productsContext}`;

        const requestMessages = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message }
        ];

        // 3. Отправка в Polza.ai API
        const aiRes = await fetch("https://polza.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: requestMessages,
                stream: true,
                temperature: 0.1,
                max_tokens: 1500
            })
        });

        if (!aiRes.ok) {
            const err = await aiRes.text();
            console.error("Polza chat API error:", err);
            return NextResponse.json({ error: "Ошибка нейросети: " + err }, { status: aiRes.status, headers: corsHeaders });
        }

        // 4. Стриминг ответа на клиент (Polza SSE)
        return new NextResponse(aiRes.body, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (error) {
        console.error("Chat API error:", error);
        return NextResponse.json({ error: "Внутренняя ошибка чата" }, { status: 500, headers: corsHeaders });
    }
}
