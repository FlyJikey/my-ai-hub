import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { logApiError } from "@/lib/logger";

export const runtime = 'nodejs'; // Keep as nodejs or edge

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
    try {
        const { prompt, provider = "polza", modelId, chatHistory } = await req.json();

        if (!prompt && (!chatHistory || chatHistory.length === 0)) {
            return NextResponse.json({ error: "Промпт обязателен" }, { status: 400 });
        }
        if (!modelId) {
            return NextResponse.json({ error: "ID Модели обязательно" }, { status: 400 });
        }

        const polzaKey = process.env.POLZA_API_KEY;
        let resultText = "";
        let errorMsg = "";

        if (provider === "polza") {
            if (!polzaKey) {
                return NextResponse.json({ error: "Ключ POLZA_API_KEY не задан в .env.local" }, { status: 400 });
            }
            try {
                const res = await fetch("https://polza.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${polzaKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: chatHistory || [
                            { role: "system", content: "You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts. Keep foreign brand names, models, and original text in their original language." },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.7,
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    resultText = data.choices[0].message.content;
                } else {
                    const err = await res.json();
                    errorMsg = err.error?.message || err.message || "Ошибка API Polza";
                    await logApiError('text', provider, modelId, errorMsg, err);
                }
            } catch (e) { errorMsg = e.message; }
        } else if (provider === "groq" || !provider) {
            // Перенаправляем Polza на бесплатный Groq (Llama 3.3)
            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) {
                return NextResponse.json({ error: "Ключ GROQ_API_KEY не задан в .env.local" }, { status: 400 });
            }
            // Форсируем модель Llama 3.3 70B, если пришла старая от Polza 
            const finalModelId = modelId.includes("polza") ? "llama-3.3-70b-versatile" : modelId;
            try {
                const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${groqKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: finalModelId,
                        messages: chatHistory || [
                            { role: "system", content: "You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts. Keep foreign brand names, models, and original text in their original language." },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.7,
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    resultText = data.choices[0].message.content;
                } else {
                    const err = await res.json();
                    errorMsg = err.error?.message || err.message || "Ошибка API Groq";
                    await logApiError('text', provider, finalModelId, errorMsg, err);
                }
            } catch (e) { errorMsg = e.message; }
        } else if (provider === "gemini") {
            const geminiKey = process.env.GEMINI_API_KEY;
            if (!geminiKey) {
                return NextResponse.json({ error: "Ключ GEMINI_API_KEY не задан в .env.local" }, { status: 400 });
            }
            try {
                const ai = new GoogleGenAI({ apiKey: geminiKey });
                const response = await ai.models.generateContent({
                    model: modelId,
                    contents: `You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts. Keep foreign brand names, models, and original text in their original language.\n\nЗадание:\n${prompt}`,
                });
                resultText = response.text;
            } catch (e) {
                errorMsg = e.message || "Ошибка API Gemini";
                await logApiError('text', provider, modelId, errorMsg, { stack: e.stack });
            }
        } else if (provider === "groq") {
            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) {
                return NextResponse.json({ error: "Ключ GROQ_API_KEY не задан в .env.local" }, { status: 400 });
            }
            try {
                const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${groqKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: chatHistory || [
                            { role: "system", content: "You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts. Keep foreign brand names, models, and original text in their original language." },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.7,
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    resultText = data.choices[0].message.content;
                } else {
                    const err = await res.json();
                    errorMsg = err.error?.message || err.message || "Ошибка API Groq";
                    await logApiError('text', provider, modelId, errorMsg, err);
                }
            } catch (e) { errorMsg = e.message; }
        } else if (provider === "openrouter") {
            const openRouterKey = process.env.OPENROUTER_API_KEY;
            if (!openRouterKey) {
                return NextResponse.json({ error: "Ключ OPENROUTER_API_KEY не задан в .env.local" }, { status: 400 });
            }
            try {
                const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${openRouterKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: chatHistory || [
                            { role: "system", content: "You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts. Keep foreign brand names, models, and original text in their original language." },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.7,
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    resultText = data.choices[0].message.content;
                } else {
                    const err = await res.json();
                    errorMsg = err.error?.message || err.message || "Ошибка API OpenRouter";
                    await logApiError('text', provider, modelId, errorMsg, err);
                }
            } catch (e) { errorMsg = e.message; }
        } else if (provider === "omniroute") {
            const omnirouteKey = process.env.OMNIROUTE_API_KEY;
            const omnirouteBaseUrl = process.env.OMNIROUTE_BASE_URL || "http://89.208.14.46:20128/v1";
            if (!omnirouteKey) {
                return NextResponse.json({ error: "Ключ OMNIROUTE_API_KEY не задан в .env.local" }, { status: 400 });
            }
            try {
                const res = await fetch(`${omnirouteBaseUrl}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${omnirouteKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: chatHistory || [
                            { role: "system", content: "You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts. Keep foreign brand names, models, and original text in their original language." },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.7,
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    resultText = data.choices[0].message.content;
                } else {
                    const err = await res.json();
                    errorMsg = err.error?.message || err.message || "Ошибка API OmniRoute";
                    await logApiError('text', provider, modelId, errorMsg, err);
                }
            } catch (e) { errorMsg = e.message; }
        } else if (provider === "huggingface") {
            const hfKey = process.env.HUGGINGFACE_API_KEY;
            if (!hfKey) {
                return NextResponse.json({ error: "Ключ HUGGINGFACE_API_KEY не задан в .env.local" }, { status: 400 });
            }
            try {
                const res = await fetch(`https://api-inference.huggingface.co/models/${modelId}/v1/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${hfKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: chatHistory || [
                            { role: "system", content: "You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts. Keep foreign brand names, models, and original text in their original language." },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 2000
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    resultText = data.choices[0].message.content;
                } else {
                    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
                    errorMsg = err.error?.message || err.message || "Ошибка API HuggingFace";
                    await logApiError('text', provider, modelId, errorMsg, err);
                }
            } catch (e) { errorMsg = e.message; }
        } else {
            return NextResponse.json({ error: `Провайдер ${provider} временно не поддерживается.` }, { status: 400 });
        }

        if (!resultText) {
            return NextResponse.json({ error: `Не удалось сгенерировать текст (${provider} / ${modelId}): ${errorMsg}` }, { status: 500, headers: corsHeaders });
        }

        return NextResponse.json({ result: resultText }, { headers: corsHeaders });

    } catch (error) {
        console.error("Text API error:", error);
        try {
            await logApiError('text', 'unknown', 'unknown', error.message || "Unknown error inside text API", { stack: error.stack });
        } catch (e) { }

        return NextResponse.json(
            { error: "Внутренняя ошибка сервера: " + error.message },
            { status: 500, headers: corsHeaders }
        );
    }
}
