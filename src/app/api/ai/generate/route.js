import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs'; // or edge does not matter but good practice
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
    // Добавляем CORS-заголовки к ответу
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res?.headers?.set(key, value);
    });
    return res;
}



async function handlePost(req) {
    try {
        const body = await req.json();
        // Принимаем параметры: либо name, либо productName.
        const productName = body.name || body.productName;
        const imageUrl = body.imageUrl;
        const category = body.category || "Не указана";
        const scenarioId = body.scenario || body.scenarioId || "seo";

        // 1. Проверки
        if (!productName) return NextResponse.json({ error: "Необходимо передать название товара (name)" }, { status: 400 });

        const { data: settingsData } = await supabase
            .from('ai_settings')
            .select('*')
            .eq('id', 'global')
            .single();

        const scenarios = settingsData?.data?.scenarios || [];
        const scenarioObj = scenarios.find(s => s.id === scenarioId);
        let scenarioPrompt = scenarioObj ? scenarioObj.prompt : "Напиши продающее описание товара.";

        const textModelId = body.textModelId || body.textModel || body.modelId || "llama-3.3-70b-versatile";
        const visionModelId = body.visionModelId || body.visionModel || "nvidia/nemotron-nano-12b-v2-vl:free";

        const textModels = settingsData?.data?.textModels || [];
        const visionModels = settingsData?.data?.visionModels || [];
        const behaviors = settingsData?.data?.behaviors || [];

        // Determine active behavior
        const activeBehavior = behaviors.find(b => b.isActive) || {
            visionPrompt: `СТРОГОЕ ПРАВИЛО: Описывай ТОЛЬКО то, что БУКВАЛЬНО ВИДИШЬ на фото. ЗАПРЕЩЕНО додумывать.
ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Весь твой ответ должен быть СТРОГО на русском языке. Исключение — оригинальные иностранные надписи, бренды: их переписывай дословно на оригинальном языке.
ВАЖНОЕ ПРАВИЛО JSON: ЗАПРЕЩЕНО использовать двойные кавычки (") внутри текстовых значений! Используй одинарные (').

Задача:
1. Изучи ВСЕ надписи и детали на предмете (дословно).
2. Подробно опиши форму, цвет, материал.
Ответь ТОЛЬКО валидным JSON:
{
  "productName": "Тип предмета СТРОГО на русском языке + бренд (оригинал).",
  "description": "Фактическое описание внешнего вида: форма, размеры, кнопки, расположение элементов",
  "attributes": {
    "Цвет": "цвет",
    "Форма": "форма",
    "Материал": "материал, если понятен",
    "Надписи на корпусе": "весь найденный текст дословно"
  },
  "tags": ["тип", "факт1"]
}`,
            systemPrompt: "You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts.",
            temperature: 0.5,
            top_p: 0.9,
            top_k: 40,
            repetition_penalty: 1.15,
            max_tokens: 2000
        };

        // Determine providers from settings or body, fallback to logic
        const matchedTextModel = textModels.find(m => m.id === textModelId);
        const matchedVisionModel = visionModels.find(m => m.id === visionModelId);

        let visionProvider = body.visionProvider || matchedVisionModel?.provider || "openrouter";
        if (!body.visionProvider && !matchedVisionModel && visionModelId !== 'none') {
            if (visionModelId.includes('gpt') || visionModelId.includes('gemini') || visionModelId.includes('polza')) visionProvider = 'polza';
        }

        let textProvider = body.textProvider || body.provider || matchedTextModel?.provider;
        if (!textProvider) {
            if (textModelId.includes('/')) {
                textProvider = "polza"; // openai/gpt-4o, deepseek/deepseek-chat и др.
            } else {
                textProvider = "groq"; // llama-3.3-70b-versatile, qwen
            }
        }

        // ============================================
        // ЭТАП 1: VISION (Dynamic Provider)
        // ============================================
        let visionData = { attributes: {}, tags: [], description: "Нет фото" };

        if (imageUrl) {
            const visionPromptText = `СТРОГОЕ ПРАВИЛО: Описывай ТОЛЬКО то, что БУКВАЛЬНО ВИДИШЬ на фото. ЗАПРЕЩЕНО додумывать.
ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Весь твой ответ должен быть СТРОГО на русском языке. Исключение — оригинальные иностранные надписи, бренды: их переписывай дословно на оригинальном языке.
ВАЖНОЕ ПРАВИЛО JSON: ЗАПРЕЩЕНО использовать двойные кавычки (") внутри текстовых значений! Используй одинарные (').

Задача:
1. Изучи ВСЕ надписи и детали на предмете (дословно).
2. Подробно опиши форму, цвет, материал.
Ответь ТОЛЬКО валидным JSON:
{
  "productName": "Тип предмета СТРОГО на русском языке + бренд (оригинал).",
  "description": "Фактическое описание внешнего вида: форма, размеры, кнопки, расположение элементов",
  "attributes": {
    "Цвет": "цвет",
    "Форма": "форма",
    "Материал": "материал, если понятен",
    "Надписи на корпусе": "весь найденный текст дословно"
  },
  "tags": ["тип", "факт1"]
}`;

            try {
                let vRes;
                if (visionProvider === "polza") {
                    const polzaKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
                    if (!polzaKey) return NextResponse.json({ error: "Не настроен POLZA_API_KEY в AI Hub" }, { status: 500 });

                    console.log(`[Vision] Using Polza. Model: ${visionModelId}. Key length: ${polzaKey.length}, Starts with: ${polzaKey.substring(0, 4)}***`);

                    vRes = await fetch("https://api.polza.ai/v1/chat/completions", {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${polzaKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: visionModelId,
                            messages: [
                                {
                                    role: "user",
                                    content: [
                                        { type: "text", text: visionPromptText },
                                        { type: "image_url", image_url: { url: imageUrl } }
                                    ]
                                }
                            ],
                            temperature: 0.1
                        })
                    });
                } else if (visionProvider === "omniroute") {
                    const omnirouteKey = (process.env.OMNIROUTE_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
                    const omnirouteBaseUrl = process.env.OMNIROUTE_BASE_URL || "http://89.208.14.46:20128/v1";
                    if (!omnirouteKey) return NextResponse.json({ error: "Не настроен OMNIROUTE_API_KEY в AI Hub" }, { status: 500 });

                    console.log(`[Vision] Using OmniRoute. Model: ${visionModelId}. Key length: ${omnirouteKey.length}, Starts with: ${omnirouteKey.substring(0, 4)}***`);

                    vRes = await fetch(`${omnirouteBaseUrl}/chat/completions`, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${omnirouteKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: visionModelId,
                            messages: [
                                {
                                    role: "user",
                                    content: [
                                        { type: "text", text: visionPromptText },
                                        { type: "image_url", image_url: { url: imageUrl } }
                                    ]
                                }
                            ],
                            temperature: 0.1
                        })
                    });
                } else {
                    // Default to OpenRouter
                    const orKey = (process.env.OPENROUTER_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
                    if (!orKey) return NextResponse.json({ error: "Не настроен OPENROUTER_API_KEY в AI Hub" }, { status: 500 });

                    console.log(`[Vision] Using OpenRouter. Model: ${visionModelId}. Key length: ${orKey.length}, Starts with: ${orKey.substring(0, 4)}***`);

                    vRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${orKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: visionModelId,
                            messages: [
                                {
                                    role: "user",
                                    content: [
                                        { type: "text", text: visionPromptText },
                                        { type: "image_url", image_url: { url: imageUrl } }
                                    ]
                                }
                            ],
                            temperature: 0.1
                        })
                    });
                }

                if (vRes.ok) {
                    const data = await vRes.json();
                    let rawContent = data.choices[0].message.content;

                    // Парсинг JSON из ответа
                    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) rawContent = jsonMatch[0];
                    else rawContent = rawContent.replace(/^```json/g, "").replace(/```$/g, "").trim();

                    visionData = JSON.parse(rawContent);
                } else {
                    const errText = await vRes.text();
                    console.error("Vision API Error", errText);
                    return NextResponse.json({ error: "Ошибка Vision API: " + errText }, { status: 500 });
                }
            } catch (e) {
                console.error("Failed Vision parsing or fetch", e);
                return NextResponse.json({ error: "Ошибка при обработке Vision: " + e.message }, { status: 500 });
            }
        }

        // ============================================
        // ЭТАП 2: TEXT (Dynamic Provider: Polza / Groq / OpenRouter)
        // ============================================

        const characteristics = Object.entries(visionData.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
        const tags = (visionData.tags || []).join(", ");

        const fullContextPrompt = `
Данные из базы магазина:
- Название: ${productName}
- Категория: ${category}

Данные от модуля распознавания фото:
- Предмет на фото: ${visionData.productName || "Неизвестно"}
- Детали фото: ${visionData.description || "нет"}
- Характеристики с фото: ${characteristics}
- Теги: ${tags}

🎯 Сценарий:
${scenarioPrompt}

Пиши только на русском языке, без лишних вступлений, сразу выдай готовый текст.`;

        let finalText = "";
        let tRes;
        let textData;

        if (textProvider === "polza") {
            const polzaKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            if (!polzaKey) return NextResponse.json({ error: "Не настроен POLZA_API_KEY в AI Hub" }, { status: 500 });

            console.log(`[Text] Using Polza. Model: ${textModelId}. Key length: ${polzaKey.length}, Starts with: ${polzaKey.substring(0, 4)}***`);

            tRes = await fetch("https://api.polza.ai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${polzaKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: textModelId,
                    messages: [
                        { role: "system", content: activeBehavior.systemPrompt },
                        { role: "user", content: fullContextPrompt }
                    ],
                    temperature: Number(activeBehavior.temperature) || 0.5,
                    top_p: Number(activeBehavior.top_p) || 0.9,
                    top_k: Number(activeBehavior.top_k) || 40,
                    repetition_penalty: Number(activeBehavior.repetition_penalty) || 1.15,
                    max_tokens: Number(activeBehavior.max_tokens) || 2000
                })
            });
            if (!tRes.ok) {
                const errText = await tRes.text();
                return NextResponse.json({ error: "Ошибка Polza API: " + errText }, { status: 500 });
            }
            textData = await tRes.json();
            finalText = textData.choices[0].message.content.trim();

        } else if (textProvider === "groq") {
            const groqKey = (process.env.GROQ_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            if (!groqKey) return NextResponse.json({ error: "Не настроен GROQ_API_KEY в AI Hub" }, { status: 500 });

            console.log(`[Text] Using Groq. Model: ${textModelId}. Key length: ${groqKey.length}, Starts with: ${groqKey.substring(0, 4)}***`);

            tRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: textModelId,
                    messages: [
                        { role: "system", content: activeBehavior.systemPrompt },
                        { role: "user", content: fullContextPrompt }
                    ],
                    temperature: activeBehavior.temperature != null ? Number(activeBehavior.temperature) : 0.5,
                    top_p: activeBehavior.top_p != null ? Number(activeBehavior.top_p) : 0.9,
                    max_tokens: activeBehavior.max_tokens != null ? Number(activeBehavior.max_tokens) : 2000
                    // Groq usually doesn't strictly support repetition_penalty or top_k natively via OpenAI compat depending on the model
                })
            });

            if (!tRes.ok) {
                const errText = await tRes.text();
                return NextResponse.json({ error: "Ошибка Groq API: " + errText }, { status: 500 });
            }
            textData = await tRes.json();
            finalText = textData.choices[0].message.content.trim();

        } else if (textProvider === "omniroute") {
            const omnirouteKey = (process.env.OMNIROUTE_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            const omnirouteBaseUrl = process.env.OMNIROUTE_BASE_URL || "http://89.208.14.46:20128/v1";
            if (!omnirouteKey) return NextResponse.json({ error: "Не настроен OMNIROUTE_API_KEY в AI Hub" }, { status: 500 });

            console.log(`[Text] Using OmniRoute. Model: ${textModelId}. Key length: ${omnirouteKey.length}, Starts with: ${omnirouteKey.substring(0, 4)}***`);

            tRes = await fetch(`${omnirouteBaseUrl}/chat/completions`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${omnirouteKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: textModelId,
                    messages: [
                        { role: "system", content: activeBehavior.systemPrompt },
                        { role: "user", content: fullContextPrompt }
                    ],
                    temperature: activeBehavior.temperature != null ? Number(activeBehavior.temperature) : 0.5,
                    top_p: activeBehavior.top_p != null ? Number(activeBehavior.top_p) : 0.9,
                    max_tokens: activeBehavior.max_tokens != null ? Number(activeBehavior.max_tokens) : 2000
                })
            });

            if (!tRes.ok) {
                const errText = await tRes.text();
                return NextResponse.json({ error: "Ошибка OmniRoute API: " + errText }, { status: 500 });
            }
            textData = await tRes.json();
            finalText = textData.choices[0].message.content.trim();

        } else {
            // Default OpenRouter fallback for text if provider not matched
            const orKey = (process.env.OPENROUTER_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            if (!orKey) return NextResponse.json({ error: "Не настроен OPENROUTER_API_KEY в AI Hub" }, { status: 500 });

            console.log(`[Text] Using OpenRouter. Model: ${textModelId}. Key length: ${orKey.length}, Starts with: ${orKey.substring(0, 4)}***`);

            tRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${orKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: textModelId,
                    messages: [
                        { role: "system", content: activeBehavior.systemPrompt },
                        { role: "user", content: fullContextPrompt }
                    ],
                    temperature: activeBehavior.temperature != null ? Number(activeBehavior.temperature) : 0.5,
                    top_p: activeBehavior.top_p != null ? Number(activeBehavior.top_p) : 0.9,
                    top_k: activeBehavior.top_k != null ? Number(activeBehavior.top_k) : 40,
                    repetition_penalty: activeBehavior.repetition_penalty != null ? Number(activeBehavior.repetition_penalty) : 1.15,
                    max_tokens: activeBehavior.max_tokens != null ? Number(activeBehavior.max_tokens) : 2000
                })
            });

            if (!tRes.ok) {
                const errText = await tRes.text();
                return NextResponse.json({ error: "Ошибка OpenRouter API: " + errText }, { status: 500 });
            }
            textData = await tRes.json();
            finalText = textData.choices[0].message.content.trim();
        }

        // Очистка от маркдауна, если Llama всё-таки его добавила
        if (finalText.startsWith('```markdown')) finalText = finalText.replace(/^```markdown\n/, '').replace(/\n```$/, '');
        else if (finalText.startsWith('```')) finalText = finalText.replace(/^```\n/, '').replace(/\n```$/, '');

        // 3. Возврат результата (возвращаем и description, и resultText для совместимости)
        return NextResponse.json({
            success: true,
            description: finalText,
            resultText: finalText,
            visionData: visionData
        });

    } catch (error) {
        console.error("Generation API error:", error);
        return NextResponse.json({ error: "Внутренняя ошибка сервера AI Hub: " + error.message }, { status: 500 });
    }
}
