import { supabase } from "@/lib/supabase";
import {
    buildSearchDescriptor,
    detectProductBrand,
    normalizeBrandLabel,
    normalizeCatalogText,
    scoreTextMatch
} from "@/lib/catalog-synonyms";
import { getCatalogEmbeddingConfig } from "@/lib/catalog-settings";

const PRODUCT_PAGE_SIZE = 1000;

function toAttributesObject(attributes) {
    if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
        return {};
    }

    return attributes;
}

function buildAttributesText(attributes) {
    return Object.entries(toAttributesObject(attributes))
        .map(([key, value]) => `${key}: ${value}`)
        .join(" | ");
}

export function buildProductSearchText(product) {
    const attributes = toAttributesObject(product?.attributes);
    const brand = detectProductBrand(attributes, product?.brand || "");

    return [
        product?.name,
        product?.category,
        product?.description,
        product?.raw_text,
        brand ? `Бренд: ${brand}` : "",
        buildAttributesText(attributes)
    ]
        .filter(Boolean)
        .join(" | ");
}

export function getProductBrand(product) {
    const brand = detectProductBrand(toAttributesObject(product?.attributes), product?.brand || "");
    return normalizeBrandLabel(brand);
}

export async function getCatalogStatsSnapshot() {
    const { count: total, error: totalError } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });

    if (totalError) {
        throw new Error(totalError.message || "Не удалось получить количество товаров");
    }

    const { count: vectorized, error: vectorizedError } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .not("embedding", "is", null);

    if (vectorizedError) {
        throw new Error(vectorizedError.message || "Не удалось получить количество векторизованных товаров");
    }

    return {
        total: total || 0,
        vectorized: vectorized || 0
    };
}

export async function fetchAllCatalogProducts() {
    const allProducts = [];
    let from = 0;

    while (true) {
        const to = from + PRODUCT_PAGE_SIZE - 1;
        const { data, error } = await supabase
            .from("products")
            .select("id, sku, name, category, description, price, attributes, raw_text")
            .order("id", { ascending: true })
            .range(from, to);

        if (error) {
            throw new Error(error.message || "Не удалось загрузить каталог товаров");
        }

        if (!data || data.length === 0) {
            break;
        }

        allProducts.push(
            ...data.map((product) => ({
                ...product,
                attributes: toAttributesObject(product.attributes)
            }))
        );

        if (data.length < PRODUCT_PAGE_SIZE) {
            break;
        }

        from += PRODUCT_PAGE_SIZE;
    }

    return allProducts;
}

function compareByScoreDesc(a, b) {
    if (b.score !== a.score) {
        return b.score - a.score;
    }

    return String(a.product?.name || "").localeCompare(String(b.product?.name || ""), "ru");
}

function scoreCatalogProduct(product, descriptor) {
    const searchText = buildProductSearchText(product);
    let score = scoreTextMatch(searchText, descriptor);

    if (!score) {
        return 0;
    }

    const normalizedName = normalizeCatalogText(product?.name);
    const normalizedCategory = normalizeCatalogText(product?.category);
    const normalizedQuery = descriptor?.normalizedQuery || "";

    if (normalizedQuery && normalizedName.includes(normalizedQuery)) {
        score += 35;
    }

    if (normalizedQuery && normalizedCategory.includes(normalizedQuery)) {
        score += 25;
    }

    const brand = normalizeCatalogText(getProductBrand(product));
    if (brand && normalizedQuery && brand.includes(normalizedQuery)) {
        score += 30;
    }

    return score;
}

export function rankCatalogProducts(products, query) {
    const descriptor = buildSearchDescriptor(query);

    if (!descriptor.normalizedQuery) {
        return [];
    }

    return products
        .map((product) => ({
            product,
            score: scoreCatalogProduct(product, descriptor)
        }))
        .filter((entry) => entry.score > 0)
        .sort(compareByScoreDesc);
}

async function getEmbeddingApiConfig(provider) {
    if (provider === "polza") {
        const apiKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^\"|\"$|^'|'$)/g, "");
        if (!apiKey) {
            return null;
        }

        return {
            apiKey,
            apiUrl: "https://polza.ai/api/v1/embeddings"
        };
    }

    if (provider === "openrouter") {
        const apiKey = (process.env.OPENROUTER_API_KEY || "").trim().replace(/(^\"|\"$|^'|'$)/g, "");
        if (!apiKey) {
            return null;
        }

        return {
            apiKey,
            apiUrl: "https://openrouter.ai/api/v1/embeddings"
        };
    }

    return null;
}

export async function runSemanticCatalogSearch(query, limit = 20) {
    try {
        const embeddingConfig = await getCatalogEmbeddingConfig();
        const providerConfig = await getEmbeddingApiConfig(embeddingConfig.provider);

        if (!providerConfig) {
            return [];
        }

        const embedRes = await fetch(providerConfig.apiUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${providerConfig.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: embeddingConfig.model,
                input: [query]
            })
        });

        if (!embedRes.ok) {
            return [];
        }

        const embedData = await embedRes.json();
        const queryEmbedding = embedData?.data?.[0]?.embedding;

        if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
            return [];
        }

        const { data, error } = await supabase.rpc("match_products", {
            query_embedding: queryEmbedding,
            match_count: limit
        });

        if (error) {
            console.warn("[CATALOG] Semantic search RPC failed:", error.message || error);
            return [];
        }

        return (data || []).map((product) => ({
            ...product,
            attributes: toAttributesObject(product.attributes)
        }));
    } catch (error) {
        console.warn("[CATALOG] Semantic search failed:", error.message || error);
        return [];
    }
}

export async function searchCatalogProducts(query, options = {}) {
    const { limit = 20, offset = 0, useSemanticFallback = true, products = null } = options;
    const catalogProducts = Array.isArray(products) ? products : await fetchAllCatalogProducts();
    const rankedEntries = rankCatalogProducts(catalogProducts, query);
    const exactMatches = rankedEntries.map((entry) => entry.product);
    let mergedResults = [...exactMatches];
    let semanticFallbackUsed = false;

    if (useSemanticFallback && mergedResults.length < Math.min(limit, 5)) {
        const semanticResults = await runSemanticCatalogSearch(query, Math.max(limit * 2, 20));
        if (semanticResults.length > 0) {
            semanticFallbackUsed = true;
            const seenIds = new Set(mergedResults.map((product) => product.id));
            for (const product of semanticResults) {
                if (!seenIds.has(product.id)) {
                    mergedResults.push(product);
                    seenIds.add(product.id);
                }
            }
        }
    }

    return {
        query,
        totalMatches: mergedResults.length,
        allMatches: mergedResults,
        results: mergedResults.slice(offset, offset + limit),
        semanticFallbackUsed
    };
}

export function summarizeBrands(products) {
    const brandMap = new Map();

    for (const product of products) {
        const brand = getProductBrand(product);
        if (!brand) {
            continue;
        }

        const key = normalizeCatalogText(brand);
        const current = brandMap.get(key);
        if (current) {
            current.count += 1;
            continue;
        }

        brandMap.set(key, { brand, count: 1 });
    }

    return Array.from(brandMap.values()).sort((a, b) => {
        if (b.count !== a.count) {
            return b.count - a.count;
        }
        return a.brand.localeCompare(b.brand, "ru");
    });
}

export function summarizeCategories(products, limit = 10) {
    const categoryMap = new Map();

    for (const product of products) {
        const category = String(product?.category || "").trim();
        if (!category) {
            continue;
        }

        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    }

    return Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.category.localeCompare(b.category, "ru");
        })
        .slice(0, limit);
}

export function formatProductPreview(product) {
    return {
        id: product.id,
        sku: product.sku || "N/A",
        name: product.name || "Без названия",
        category: product.category || "Без категории",
        price: product.price || 0,
        brand: getProductBrand(product)
    };
}
