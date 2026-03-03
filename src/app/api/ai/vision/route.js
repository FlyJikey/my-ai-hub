import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req) {
    try {
        const formData = await req.formData();
        const imageFile = formData.get("image");
        const provider = formData.get("provider") || "polza";
        const modelId = formData.get("modelId");

        if (!modelId) {
            return NextResponse.json({ error: "ID Модели обязательно" }, { status: 400 });
        }

        if (!imageFile || typeof imageFile === "string") {
            return NextResponse.json({ error: "Изображение обязательно" }, { status: 400 });
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

        const promptText = `
СТРОГОЕ ПРАВИЛО: Описывай ТОЛЬКО то, что БУКВАЛЬНО ВИДИШЬ на фото. ЗАПРЕЩЕНО додумывать.
ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Весь твой ответ должен быть СТРОГО на русском языке. Исключение — оригинальные иностранные надписи, бренды, маркировки с фото: их переписывай дословно на оригинальном языке.
ВАЖНОЕ ПРАВИЛО JSON: КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать двойные кавычки (") внутри значений! Если нужно выделить текст, используй одинарные кавычки ('). Иначе сломается парсер.

Задача:
1. Внимательно изучи ВСЕ надписи и детали на предмете — запиши текст дословно на оригинальном языке.
2. Очень подробно опиши физические характеристики: все видимые элементы, кнопки, форму, расположение (на русском языке).
3. Избегай маркетинговой воды, дай точные фактические данные для копирайтера.

Ответь ТОЛЬКО валидным JSON, без маркдауна (без оберток \`\`\`json). Строгая структура:
{
  "productName": "Тип предмета СТРОГО на русском языке (например: Пульт, Чехол). Сюда же добавь бренд/модель на оригинальном языке. ЗАПРЕЩЕНО писать тип предмета по-английски (никаких 'Remote control').",
  "description": "Очень подробное фактическое описание всего, что ты видишь (строго на русском). Отметь расположение всех элементов, надписи и внешний вид.",
  "attributes": {
    "Цвет": "видимый цвет (на русском)",
    "Форма": "физическая форма (на русском)",
    "Материал": "если понятно, то материал (на русском)",
  },
  "tags": ["тип предмета", "доп факты", "на русском"]
}`;

        if (provider === "polza") {
            const res = await fetch("https://api.polza.ai/v1/chat/completions", {
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
                throw new Error(errorData.error?.message || errorData.message || "Ошибка Vision API Polza");
            }

            const data = await res.json();
            textResponse = data.choices[0].message.content;
        } else if (provider === "openrouter" || !provider) {

            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openRouterKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: finalModelId,
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
                throw new Error(errorData.error?.message || "Ошибка Vision API OpenRouter");
            }

            const data = await res.json();
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

        const parsedResult = JSON.parse(textResponse);
        return NextResponse.json({ result: parsedResult });

    } catch (error) {
        console.error("Vision AI error:", error);
        return NextResponse.json(
            { error: "Внутренняя ошибка сервера: " + error.message },
            { status: 500 }
        );
    }
}
