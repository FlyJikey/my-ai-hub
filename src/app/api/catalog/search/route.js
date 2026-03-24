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
        const query = body.query || "";
        const limit = body.limit || 20;
        const offset = body.offset || 0;
        const embeddingModel = body.embeddingModel || "text-embedding-3-small";
        const embeddingProvider = body.embeddingProvider || "polza";

        if (!query.trim()) {
            return NextResponse.json({ error: "Пустой запрос" }, { status: 400, headers: corsHeaders });
        }

        console.log(`[CATALOG SEARCH] Запрос: "${query}", модель: ${embeddingModel} (${embeddingProvider}), limit: ${limit}, offset: ${offset}`);

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

        // 1. Создание эмбеддинга для запроса
        const embedRes = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: embeddingModel,
                input: [query]
            })
        });

        if (!embedRes.ok) {
            const err = await embedRes.text();
            console.error("[CATALOG SEARCH] Ошибка создания embedding:", err);
            return NextResponse.json({ error: "Ошибка создания эмбеддинга запроса" }, { status: 500, headers: corsHeaders });
        }

        const embedData = await embedRes.json();
        const queryEmbedding = embedData.data[0].embedding;
        
        console.log(`[CATALOG SEARCH] Embedding создан, размерность: ${queryEmbedding.length}`);

        // 2. Векторный поиск через Supabase RPC
        // Получаем больше товаров для поддержки offset на уровне JS
        // Максимум 200 товаров за раз (100 лимит + 100 offset)
        const matchCount = Math.min(limit + offset, 200);
        
        const { data: allProducts, error: rpcError } = await supabase.rpc('match_products', {
            query_embedding: queryEmbedding,
            match_count: matchCount
        });

        if (rpcError) {
            console.error("[CATALOG SEARCH] Ошибка RPC match_products:", rpcError);
            return NextResponse.json({ error: "Ошибка поиска в базе данных: " + rpcError.message }, { status: 500, headers: corsHeaders });
        }

        // Применить offset на уровне JS
        const products = allProducts ? allProducts.slice(offset, offset + limit) : [];

        console.log(`[CATALOG SEARCH] Найдено товаров: ${(products || []).length} (offset: ${offset}, limit: ${limit})`);

        return NextResponse.json({
            results: products || [],
            query,
            count: (products || []).length
        }, { headers: corsHeaders });

    } catch (error) {
        console.error("[CATALOG SEARCH] Внутренняя ошибка:", error);
        return NextResponse.json({ error: "Внутренняя ошибка поиска: " + error.message }, { status: 500, headers: corsHeaders });
    }
}
