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
        const formData = await req.formData();
        const imageFile = formData.get("image");
        const provider = formData.get("provider") || "polza";
        const modelId = formData.get("modelId");
        const mode = formData.get("mode") || "price_tag";

        if (!modelId) {
            return NextResponse.json({ error: "ID Модели обязательно" }, { status: 400 });
        }

        if (!imageFile || typeof imageFile === "string") {
            return NextResponse.json({ error: "Изображение обязательно" }, { status: 400 });
        }

        // Check file size (max 10MB for images)
        const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
        if (imageFile.size > MAX_IMAGE_SIZE) {
            return NextResponse.json({ 
                error: `Изображение слишком большое. Максимальный размер: ${MAX_IMAGE_SIZE / 1024 / 1024}MB` 
            }, { status: 400 });
        }

        const polzaKey = process.env.POLZA_API_KEY;
        if (!polzaKey && provider === "polza") {
            return NextResponse.json({ error: "API ключ POLZA_API_KEY не настроен (.env.local)" }, { status: 500 });
        }

        // Read file bytes and convert to base64
        const buffer = await imageFile.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString("base64");
        const mimeType = imageFile.type;
        const imageUrl = `data:${mimeType};base64,${base64Image}`;

        let promptText = "";

        if (mode === "price_tag") {
            promptText = `
СТРОГОЕ ПРАВИЛО: Ищи на фото РЦЕННИК (официальный желтый или белый ценник с ценой/названием) или ЭТИКЕТКУ.
Твоя задача — извлечь текстовые данные СТРОГО с самого ценника/этикетки.
НЕ ОПИСЫВАЙ сам предмет на фоне. Меня интересует только текст на бумаге/ценнике.

ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Переписывай текст С ЦЕННИКА дословно. Если бренд/артикул по-английски — пиши по-английски. Остальное по-русски.
ВАЖНОЕ ПРАВИЛО JSON: КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать двойные кавычки (") внутри значений! Если нужно выделить текст, используй одинарные кавычки ('). Иначе сломается парсер.

Ответь ТОЛЬКО валидным JSON:
{
  "productName": "Главное название товара с ценника (включая бренд и артикул)",
  "description": "Перепиши весь остальной текст мелким шрифтом с ценника (какие-то особенности, состав, если есть). НИКАКИХ визуальных описаний самого предмета, ТОЛЬКО текст с ценника.",
  "attributes": {
    "Цена": "Извлеки цену с ценника (если есть)",
    "Штрихкод/Артикул": "Если есть явный штрихкод цифрами или артикул на ценнике"
  },
  "tags": ["ценник", "распознавание текста"]
}`;
        } else if (mode === "chat") {
            promptText = `
Твоя задача — максимально подробно описать изображение для чат-бота, чтобы он мог ответить на вопросы пользователя об этом фото.
Опиши:
1. Что изображено (главный объект, сцена).
2. Все важные детали, текст, цвета и настроения.
3. Если есть люди, опиши их действия или эмоции (без имен).

Ответь ТОЛЬКО валидным JSON:
{
  "productName": "Краткое название того, что на фото (2-4 слова)",
  "description": "Максимально подробное описание всего, что ты видишь.",
  "attributes": {
    "Основные цвета": "список цветов",
    "Детали": "ключевые объекты на фото"
  },
  "tags": ["анализ фото", "чат"]
}`;
        } else {
            promptText = `
СТРОГОЕ ПРАВИЛО: Описывай ТОЛЬКО то, что БУКВАЛЬНО ВИДИШЬ на фото. ЗАПРЕЩЕНО додумывать.
ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Весь твой ответ должен быть СТРОГО на русском языке. Исключение — оригинальные иностранные надписи, бренды: их переписывай дословно на оригинальном языке.
ВАЖНОЕ ПРАВИЛО JSON: КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать двойные кавычки (") внутри значений! Если нужно выделить текст, используй одинарные кавычки ('). Иначе сломается парсер.

Задача:
1. Внимательно изучи ВСЕ надписи и детали на предмете — запиши текст дословно на оригинальном языке.
2. Очень подробно опиши физические характеристики: все видимые элементы, кнопки, форму, расположение (на русском языке).
3. Избегай маркетинговой воды, дай точные фактические данные для копирайтера.

Ответь ТОЛЬКО валидным JSON:
{
  "productName": "Тип предмета СТРОГО на русском языке (например: Пульт, Чехол). Сюда же добавь бренд/модель на оригинальном языке.",
  "description": "Очень подробное фактическое описание всего, что ты видишь. Отметь расположение всех элементов, надписи и внешний вид.",
  "attributes": {
    "Цвет": "видимый цвет (на русском)",
    "Форма": "физическая форма (на русском)",
    "Материал": "если понятно, то материал (на русском)"
  },
  "tags": ["тип предмета", "доп факты", "на русском"]
}`;
        }

        let textResponse = "";

        if (provider === "polza") {
            const res = await fetch("https://polza.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${polzaKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: promptText },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: imageUrl
                                    }
                                }
                            ]
                        }
                    ]
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                console.error("Vision Error:", errorData);
                const errMsg = errorData.error?.message || errorData.message || "Ошибка Vision API Polza";
                await logApiError('vision', provider, modelId, errMsg, errorData);
                throw new Error(errMsg);
            }

            const data = await res.json();
            if (!data || !data.choices || data.choices.length === 0) {
                console.error("Polza Vision empty choices:", data);
                throw new Error("Нейросеть Polza вернула пустой или некорректный ответ.");
            }
            textResponse = data.choices[0].message.content;
        } else if (provider === "openrouter" || !provider) {
            const openRouterKey = process.env.OPENROUTER_API_KEY;
            if (!openRouterKey) {
                return NextResponse.json({ error: "API ключ OPENROUTER_API_KEY не настроен (.env.local)" }, { status: 500, headers: corsHeaders });
            }

            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openRouterKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: promptText },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: imageUrl
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: 0.1
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                console.error("OpenRouter Vision Error", errorData);
                const errMsg = errorData.error?.message || "Ошибка Vision API OpenRouter";
                await logApiError('vision', provider, modelId, errMsg, errorData);
                throw new Error(errMsg);
            }

            const data = await res.json();
            if (!data || !data.choices || data.choices.length === 0) {
                console.error("OpenRouter Vision empty choices:", data);
                throw new Error("OpenRouter вернул пустой ответ (choices).");
            }
            textResponse = data.choices[0].message.content;
        } else if (provider === "gemini") {
            const geminiKey = process.env.GEMINI_API_KEY;
            if (!geminiKey) {
                throw new Error("API ключ GEMINI_API_KEY не настроен (.env.local)");
            }

            const ai = new GoogleGenAI({ apiKey: geminiKey });
            const response = await ai.models.generateContent({
                model: modelId,
                contents: [
                    promptText,
                    {
                        inlineData: {
                            data: base64Image,
                            mimeType: mimeType
                        }
                    }
                ]
            });
            textResponse = response.text;
        } else {
            throw new Error(`Провайдер ${provider} временно не поддерживается для распознавания фото.`);
        }

        // Clean up markdown quotes if model returns them despite instructions
        // First, extract the JSON portion if there is surrounding text
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            textResponse = jsonMatch[0];
        } else {
            textResponse = textResponse.replace(/^```json/g, "").replace(/```$/g, "").trim();
        }

        let parsedResult;
        try {
            parsedResult = JSON.parse(textResponse);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError);
            await logApiError('vision', provider, modelId, "Ошибка парсинга JSON от нейросети", {
                raw_response: textResponse,
                error_message: parseError.message
            });
            throw new Error(`Ошибка ответа нейросети: неверный формат данных. Попробуйте еще раз. Рекомендуем сменить модель.`);
        }

        return NextResponse.json({ result: parsedResult }, { headers: corsHeaders });

    } catch (error) {
        console.error("Vision AI error:", error);
        // Best effort logging if not already caught inside
        try {
            await logApiError('vision', 'unknown', 'unknown', error.message || "Неизвестная ошибка", { stack: error.stack });
        } catch (e) { }

        return NextResponse.json(
            { error: "Внутренняя ошибка сервера: " + error.message },
            { status: 500, headers: corsHeaders }
        );
    }
}
