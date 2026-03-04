import { NextResponse } from "next/server";

export const runtime = 'nodejs'; // or edge does not matter but good practice

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

const SCENARIOS = {
    "seo": `ОЧЕНЬ ВАЖНО: Тебя просят написать продающий текст.
СТРОГОЕ ПРАВИЛО ФОРМАТИРОВАНИЯ: ЗАПРЕЩЕНО использовать любые спецсимволы Markdown (никаких #, ##, ###, *, **). Используй только чистый текст. Если нужно сделать заголовок — просто напиши его с заглавной буквы с новой строки.

Для списка характеристик выводи их СТРОГО простым текстом в столбик, в следующем формате:
Характеристики:
Цвет - [значение]
Форма - [значение]
Материал - [значение]
Надписи на корпусе - [значение]

Обязательная структура ответа:
Заголовок (Название товара)

Вводное продающее описание (пара абзацев).

Основные преимущества:
- преимущество 1
- преимущество 2

Характеристики:
Характеристика - Описание
Характеристика - Описание

Почему стоит выбрать этот товар? (нумерованный список)

Обратите внимание: (заключительная важная деталь).`,

    "short": `Напиши короткое, ёмкое и привлекательное описание товара для карточки маркетплейса. Максимум 2-3 абзаца. Укажи главные особенности и для чего товар предназначен. Не используй Markdown-символы (#, *), только чистый текст.`,

    "advantages": `Составь маркированный список из 5-8 главных преимуществ данного товара. Каждое преимущество — отдельный пункт. Кратко, по делу, без воды. Не используй Markdown-символы (#, *), только тире или галочки.`,

    "creative": `Напиши яркое, эмоциональное и креативное описание товара в стиле поста для социальных сетей. Используй эмодзи, живой язык, обращайся к покупателю на "ты". Сделай текст таким, чтобы его хотелось репостнуть.`,

    "ecommerce_pro": `Ты — Senior E-commerce Копирайтер и SEO-маркетолог. Твоя специализация — создание высококонверсионных карточек товаров для Wildberries, Ozon и Amazon. Ты пишешь емко, экспертно и без «воды», используя язык выгод для покупателя.
ЗАДАЧА: Напиши глубоко проработанный, увлекательный и продающий текст для карточки товара на основе предоставленных данных. Текст должен легко сканироваться глазами и быть оптимизирован для поиска.
СТРУКТУРА ОПИСАНИЯ (СТРОГО СОБЛЮДАЙ ПОРЯДОК):
1. SEO-Заголовок (H2): Название бренда + тип товара + главное преимущество.
2. Лид-абзац (2-3 предложения): Эмоциональный крючок и ответ на вопрос «Почему мне нужен этот товар прямо сейчас?». Раскрой главную ценность.
3. Блок выгод «Почему выбирают...» (Маркированный список 4-5 пунктов):
    * Формат: Название характеристики: Описание того, какую проблему покупателя она решает. (Формула: Свойство ➡️ Выгода).
4. Технические характеристики (Таблица): Оформи строго в виде Markdown-таблицы (Бренд, Материал, Размер, Вес, Назначение и т.д.). Характеристики возьми из вводных данных или логично выведи из визуального анализа товара.
5. Сценарии использования / Для кого (Блок-цитата >): Опиши целевую аудиторию и 2-3 конкретные ситуации, где этот товар раскроет себя лучше всего.
6. Рекомендации по уходу (Нумерованный список): 3 коротких и практичных шага, как продлить срок службы товара.
7. Призыв к действию (CTA): Емкая и мотивирующая фраза, подталкивающая добавить товар в корзину.
ПРАВИЛА И ОГРАНИЧЕНИЯ (ВАЖНО):
* Стиль: Энергичный, профессиональный. Никакой канцелярии.
* Запрещенные слова: Избегай клише («высококачественный», «уникальный», «эксклюзивный», «никого не оставит равнодушным»). Доказывай качество через факты.
* Форматирование: Активно используй жирный шрифт для ключевых мыслей в списках. Разделяй логические блоки горизонтальной линией (---). Не пиши сплошным текстом.
* SEO: Органично впиши 3-4 околотематических поисковых запроса (LSI-фразы), характерных для этого типа товара.`
};

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

        const scenarioPrompt = SCENARIOS[scenarioId] || SCENARIOS["seo"];

        // На фронтенде (my-shop2) переменные называются `textModel` и `visionModel`, без provider
        const visionModelId = body.visionModelId || body.visionModel || "nvidia/nemotron-nano-12b-v2-vl:free";
        let visionProvider = body.visionProvider || "openrouter";
        if (!body.visionProvider && visionModelId !== 'none') {
            if (visionModelId.includes('gpt') || visionModelId.includes('gemini')) visionProvider = 'polza';
        }

        // ============================================
        // ЭТАП 1: VISION (Dynamic Provider)
        // ============================================
        let visionData = { attributes: {}, tags: [], description: "Нет фото" };

        if (imageUrl) {
            const visionPromptText = `
СТРОГОЕ ПРАВИЛО: Описывай ТОЛЬКО то, что БУКВАЛЬНО ВИДИШЬ на фото. ЗАПРЕЩЕНО додумывать.
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
                    const polzaKey = process.env.POLZA_API_KEY;
                    if (!polzaKey) return NextResponse.json({ error: "Не настроен POLZA_API_KEY в AI Hub" }, { status: 500 });

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
                } else {
                    // Default to OpenRouter
                    const orKey = process.env.OPENROUTER_API_KEY;
                    if (!orKey) return NextResponse.json({ error: "Не настроен OPENROUTER_API_KEY в AI Hub" }, { status: 500 });

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
                    console.error("Vision API Error", await vRes.text());
                }
            } catch (e) {
                console.error("Failed Vision parsing or fetch", e);
            }
        }

        // Принимаем параметры для текста с фронтенда:
        const textModelId = body.textModelId || body.textModel || body.modelId || "llama-3.3-70b-versatile"; // Fallback to llama

        // Автоматически определяем провайдера, если фронтенд (my-shop2) его не прислал
        let textProvider = body.textProvider || body.provider;
        if (!textProvider) {
            if (textModelId.includes('/')) {
                textProvider = "polza"; // openai/gpt-4o, deepseek/deepseek-chat и др.
            } else {
                textProvider = "groq"; // llama-3.3-70b-versatile, qwen
            }
        }

        // ============================================
        // ЭТАП 2: TEXT (Dynamic Provider: Polza / Groq)
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
            const polzaKey = process.env.POLZA_API_KEY;
            if (!polzaKey) return NextResponse.json({ error: "Не настроен POLZA_API_KEY в AI Hub" }, { status: 500 });

            tRes = await fetch("https://api.polza.ai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${polzaKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: textModelId,
                    messages: [
                        { role: "system", content: "You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts." },
                        { role: "user", content: fullContextPrompt }
                    ],
                    temperature: 0.7,
                })
            });
            if (!tRes.ok) {
                const errText = await tRes.text();
                return NextResponse.json({ error: "Ошибка Polza API: " + errText }, { status: 500 });
            }
            textData = await tRes.json();
            finalText = textData.choices[0].message.content.trim();

        } else if (textProvider === "groq") {
            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) return NextResponse.json({ error: "Не настроен GROQ_API_KEY в AI Hub" }, { status: 500 });

            tRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: textModelId,
                    messages: [
                        { role: "system", content: "You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts." },
                        { role: "user", content: fullContextPrompt }
                    ],
                    temperature: 0.7,
                })
            });

            if (!tRes.ok) {
                const errText = await tRes.text();
                return NextResponse.json({ error: "Ошибка Groq API: " + errText }, { status: 500 });
            }
            textData = await tRes.json();
            finalText = textData.choices[0].message.content.trim();

        } else {
            // Default OpenRouter fallback for text if provider not matched
            const orKey = process.env.OPENROUTER_API_KEY;
            if (!orKey) return NextResponse.json({ error: "Не настроен OPENROUTER_API_KEY в AI Hub" }, { status: 500 });

            tRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${orKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: textModelId,
                    messages: [
                        { role: "system", content: "You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts." },
                        { role: "user", content: fullContextPrompt }
                    ],
                    temperature: 0.7,
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
        if (finalText.startsWith('\`\`\`markdown')) finalText = finalText.replace(/^\`\`\`markdown\n/, '').replace(/\n\`\`\`$/, '');
        else if (finalText.startsWith('\`\`\`')) finalText = finalText.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');

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
