import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60; // Set timeout to 60 seconds (max for Hobby)

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

        const selectedModel = body.model;
        const messages = body.messages;
        const temperature = body.temperature ?? 0.1;
        const max_tokens = body.max_tokens ?? 50;

        if (!selectedModel || !messages) {
            return NextResponse.json({ error: "Необходимы параметры model и messages" }, { status: 400 });
        }

        const { data: settingsData } = await supabase
            .from('ai_settings')
            .select('*')
            .eq('id', 'global')
            .single();

        const textModels = settingsData?.data?.textModels || [];
        const matchedModel = textModels.find(m => m.id === selectedModel);

        let provider = matchedModel?.provider;
        if (!provider) {
            // Угадываем провайдера по модели, если его нет в списке
            const isGroqModel = selectedModel.startsWith('llama') || selectedModel.startsWith('mixtral') || selectedModel.startsWith('gemma');
            if (selectedModel.includes('/')) {
                provider = 'polza'; // или 'openrouter', но Polza поддерживает форматы с / чаще в кастомных
            } else if (isGroqModel) {
                provider = 'groq';
            } else {
                provider = 'polza'; // По умолчанию для кастомных/неизвестных
            }
        }

        let apiRes;

        if (provider === 'polza') {
            const polzaKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            if (!polzaKey) return NextResponse.json({ error: "Не настроен POLZA_API_KEY" }, { status: 500 });

            apiRes = await fetch("https://api.polza.ai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${polzaKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: messages,
                    temperature: temperature,
                    max_tokens: max_tokens
                })
            });
        } else if (provider === 'groq') {
            const groqKey = (process.env.GROQ_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            if (!groqKey) return NextResponse.json({ error: "Не настроен GROQ_API_KEY" }, { status: 500 });

            apiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: messages,
                    temperature: temperature,
                    max_tokens: max_tokens
                })
            });
        } else {
            const orKey = (process.env.OPENROUTER_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            if (!orKey) return NextResponse.json({ error: "Не настроен OPENROUTER_API_KEY" }, { status: 500 });

            apiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${orKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: messages,
                    temperature: temperature,
                    max_tokens: max_tokens
                })
            });
        }

        if (!apiRes.ok) {
            const errText = await apiRes.text();
            console.error(`Error from ${provider}:`, errText);
            return NextResponse.json({ error: `Ошибка ${provider} API: ` + errText }, { status: apiRes.status });
        }

        const data = await apiRes.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error("Chat API error:", error);
        return NextResponse.json({ error: "Внутренняя ошибка сервера AI Hub: " + error.message }, { status: 500 });
    }
}
