import { NextResponse } from "next/server";

export const runtime = 'nodejs';
export const maxDuration = 60;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-version, x-csrftoken, x-requested-with',
    'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req) {
    const res = await handlePost(req);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res?.headers?.set(key, value);
    });
    return res;
}

async function handlePost(req) {
    try {
        const body = await req.json();
        const text = body.text || body.input;
        const modelId = body.model || body.modelId || "openai/text-embedding-3-small";

        if (!text) {
            return NextResponse.json({ error: "Необходим параметр text или input" }, { status: 400 });
        }

        // По умолчанию используем Polza для эмбеддингов, так как в настройках указана модель от Polza
        const polzaKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
        if (!polzaKey) {
            return NextResponse.json({ error: "Не настроен POLZA_API_KEY в AI Hub" }, { status: 500 });
        }

        console.log(`[Embed] Requesting embedding for model: ${modelId}`);

        const apiRes = await fetch("https://api.polza.ai/v1/embeddings", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${polzaKey}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                model: modelId,
                input: text,
                dimensions: 384
            })
        });

        if (!apiRes.ok) {
            const errText = await apiRes.text();
            console.error(`Error from Polza Embeddings:`, errText);
            return NextResponse.json({ error: `Ошибка Polza API (Embed): ` + errText }, { status: apiRes.status });
        }

        const data = await apiRes.json();
        
        // Возвращаем в формате, который ожидает shop (data.vector)
        const vector = data.data?.[0]?.embedding;
        
        if (!vector) {
            return NextResponse.json({ error: "Не удалось получить вектор от провайдера" }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            vector: vector,
            model: modelId
        });

    } catch (error) {
        console.error("Embed API error:", error);
        return NextResponse.json({ error: "Внутренняя ошибка сервера AI Hub: " + error.message }, { status: 500 });
    }
}
