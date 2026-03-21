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

        if (!query.trim()) {
            return NextResponse.json({ error: "Пустой запрос" }, { status: 400, headers: corsHeaders });
        }

        const polzaKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
        if (!polzaKey) {
            return NextResponse.json({ error: "Ключ POLZA_API_KEY не установлен" }, { status: 500, headers: corsHeaders });
        }

        // 1. Создание эмбеддинга для запроса
        const embedRes = await fetch("https://polza.ai/api/v1/embeddings", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${polzaKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "text-embedding-3-small",
                input: [query]
            })
        });

        if (!embedRes.ok) {
            const err = await embedRes.text();
            console.error("Search embedding error:", err);
            return NextResponse.json({ error: "Ошибка создания эмбеддинга запроса" }, { status: 500, headers: corsHeaders });
        }

        const embedData = await embedRes.json();
        const queryEmbedding = embedData.data[0].embedding;

        // 2. Векторный поиск через Supabase RPC
        const { data: products, error: rpcError } = await supabase.rpc('match_products', {
            query_embedding: queryEmbedding,
            match_count: limit
        });

        if (rpcError) {
            console.error("Supabase RPC error:", rpcError);
            return NextResponse.json({ error: "Ошибка поиска в базе данных" }, { status: 500, headers: corsHeaders });
        }

        return NextResponse.json({
            results: products || [],
            query,
            count: (products || []).length
        }, { headers: corsHeaders });

    } catch (error) {
        console.error("Search API error:", error);
        return NextResponse.json({ error: "Внутренняя ошибка поиска" }, { status: 500, headers: corsHeaders });
    }
}
