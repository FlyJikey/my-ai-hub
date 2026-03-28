import { NextResponse } from "next/server";
import { detectCatalogIntent } from "@/lib/catalog-router";
import {
    fetchAllCatalogProducts,
    formatProductPreview,
    getCatalogStatsSnapshot,
    searchCatalogProducts,
    summarizeBrands,
    summarizeCategories
} from "@/lib/catalog-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
};

const STYLE_PROMPTS = {
    concise: "Отвечай максимально кратко и по делу. Без вступлений.",
    formal: "Используй официально-деловой стиль общения. Будь вежлив и структурирован.",
    creative: "Будь креативным, но не искажай факты и цифры.",
    code: "Отвечай структурированно и строго по данным.",
    normal: "Отвечай естественно, дружелюбно и только по проверенным данным каталога."
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

function getStylePrompt(style) {
    return STYLE_PROMPTS[style] || STYLE_PROMPTS.normal;
}

function normalizeHistory(history = []) {
    return history
        .map((item) => ({
            role: item?.role === "ai" ? "assistant" : item?.role,
            text: String(item?.text || item?.content || "").trim()
        }))
        .filter((item) => item.role && item.text);
}

function formatFallbackAnswer(payload) {
    const subjectPart = payload.subject ? ` по запросу "${payload.subject}"` : "";

    if (payload.intent === "total_count") {
        return `В базе сейчас ${payload.total.toLocaleString("ru-RU")} товаров.`;
    }

    if (payload.intent === "overview") {
        const categories = payload.topCategories.map((item) => `${item.category} (${item.count})`).join(", ");
        const brands = payload.topBrands.slice(0, 15).map((item) => item.brand).join(", ");
        return `Проверил всю базу: ${payload.total.toLocaleString("ru-RU")} товаров. Топ категорий: ${categories || "нет данных"}. Бренды: ${brands || "не определены"}.`;
    }

    if (payload.intent === "brands") {
        if (payload.totalBrands === 0) {
            return payload.subject
                ? `По запросу "${payload.subject}" бренды не определились.`
                : "По всему каталогу бренды не определились.";
        }

        return `Проверил всю базу${subjectPart}: нашёл ${payload.totalBrands.toLocaleString("ru-RU")} брендов — ${payload.brands.map((item) => item.brand).join(", ")}.`;
    }

    if (payload.intent === "exists") {
        if (payload.matchedCount > 0) {
            return `Да, по запросу "${payload.subject}" найдено ${payload.matchedCount.toLocaleString("ru-RU")} товаров.`;
        }

        return `Нет, по запросу "${payload.subject}" товаров в базе не найдено.`;
    }

    if (payload.intent === "count") {
        const brands = payload.topBrands.slice(0, 10).map((item) => item.brand).join(", ");
        return `Проверил всю базу по запросу "${payload.subject}": найдено ${payload.matchedCount.toLocaleString("ru-RU")} товаров.${brands ? ` Основные бренды: ${brands}.` : ""}`;
    }

    if (payload.matchedCount === 0) {
        return `По запросу "${payload.subject}" ничего не найдено во всей базе.`;
    }

    const productNames = payload.products.slice(0, 10).map((item) => item.name).join(", ");
    return `Проверил всю базу по запросу "${payload.subject}": найдено ${payload.matchedCount.toLocaleString("ru-RU")} товаров. Примеры: ${productNames}.`;
}

function shouldUseDeterministicAnswer(payload) {
    return ["total_count", "brands", "count", "exists"].includes(payload.intent);
}

async function generateCatalogAnswer(req, { provider, modelId, style, question, contextMessage, payload }) {
    const aiUrl = new URL("/api/ai/text", req.url);
    const systemPrompt = `${getStylePrompt(style)} Ты AI-консультант по каталогу товаров. Отвечай только по данным, которые тебе передали. Не придумывай товары, бренды и количества. Всегда говори так, будто данные проверены по всей базе, а не по топ-N результатам.`;

    const userPrompt = `Вопрос пользователя: ${question}

Дополнительный контекст пользователя:
${contextMessage || "нет"}

Проверенные данные по каталогу:
${JSON.stringify(payload, null, 2)}

Сформулируй короткий, полезный ответ на русском языке. Если брендов или товаров много, сначала назови количество, затем перечисли самое важное и не теряй точность.`;

    const response = await fetch(aiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            provider,
            modelId,
            chatHistory: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Не удалось получить ответ модели");
    }

    const data = await response.json();
    return data.result;
}

export async function POST(req) {
    try {
        const body = await req.json();
        const message = String(body.message || "").trim();
        const contextMessage = String(body.contextMessage || "").trim();
        const history = normalizeHistory(body.history || []);
        const provider = body.provider || "polza";
        const modelId = body.modelId || "openai/gpt-4o-mini";
        const style = body.style || "normal";

        if (!message) {
            return NextResponse.json({ error: "Пустой запрос" }, { status: 400, headers: corsHeaders });
        }

        const detected = detectCatalogIntent(message, history);
        let payload;

        if (detected.intent === "total_count") {
            const stats = await getCatalogStatsSnapshot();
            payload = {
                intent: detected.intent,
                subject: "",
                total: stats.total,
                vectorized: stats.vectorized,
                checkedScope: "full_catalog"
            };
        } else if (detected.intent === "overview") {
            const [stats, products] = await Promise.all([
                getCatalogStatsSnapshot(),
                fetchAllCatalogProducts()
            ]);
            const brands = summarizeBrands(products);

            payload = {
                intent: detected.intent,
                subject: "",
                total: stats.total,
                vectorized: stats.vectorized,
                totalBrands: brands.length,
                topBrands: brands.slice(0, 30),
                topCategories: summarizeCategories(products, 12),
                samples: products.slice(0, 12).map(formatProductPreview),
                checkedScope: "full_catalog"
            };
        } else if (detected.intent === "brands") {
            if (!detected.subject) {
                const products = await fetchAllCatalogProducts();
                const brands = summarizeBrands(products);
                payload = {
                    intent: detected.intent,
                    subject: "",
                    totalBrands: brands.length,
                    brands,
                    matchedCount: products.length,
                    checkedScope: "full_catalog"
                };
            } else {
                const search = await searchCatalogProducts(detected.subject, {
                    limit: 40,
                    offset: 0,
                    useSemanticFallback: true
                });
                const brands = summarizeBrands(search.allMatches);
                payload = {
                    intent: detected.intent,
                    subject: detected.subject,
                    totalBrands: brands.length,
                    brands,
                    matchedCount: search.totalMatches,
                    products: search.results.map(formatProductPreview),
                    semanticFallbackUsed: search.semanticFallbackUsed,
                    checkedScope: "full_catalog"
                };
            }
        } else {
            const subject = detected.subject || detected.cleanedMessage || message;
            const search = await searchCatalogProducts(subject, {
                limit: 25,
                offset: 0,
                useSemanticFallback: true
            });
            const topBrands = summarizeBrands(search.allMatches).slice(0, 20);

            payload = {
                intent: detected.intent,
                subject,
                matchedCount: search.totalMatches,
                semanticFallbackUsed: search.semanticFallbackUsed,
                checkedScope: "full_catalog",
                topBrands,
                topCategories: summarizeCategories(search.allMatches, 10),
                products: search.results.map(formatProductPreview)
            };
        }

        let resultText = "";
        if (shouldUseDeterministicAnswer(payload)) {
            resultText = formatFallbackAnswer(payload);
        } else {
            try {
                resultText = await generateCatalogAnswer(req, {
                    provider,
                    modelId,
                    style,
                    question: message,
                    contextMessage,
                    payload
                });
            } catch (error) {
                console.warn("[CATALOG ASK] Falling back to deterministic answer:", error.message || error);
                resultText = formatFallbackAnswer(payload);
            }
        }

        return NextResponse.json(
            {
                result: resultText,
                meta: payload
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        console.error("[CATALOG ASK] Error:", error);
        return NextResponse.json(
            { error: "Внутренняя ошибка каталога: " + (error.message || error) },
            { status: 500, headers: corsHeaders }
        );
    }
}
