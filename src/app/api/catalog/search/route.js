import { NextResponse } from "next/server";
import { searchCatalogProducts } from "@/lib/catalog-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req) {
    try {
        const body = await req.json();
        const query = String(body.query || "").trim();
        const limit = Number(body.limit || 20);
        const offset = Number(body.offset || 0);

        if (!query) {
            return NextResponse.json({ error: "Пустой запрос" }, { status: 400, headers: corsHeaders });
        }

        const search = await searchCatalogProducts(query, {
            limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20,
            offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
            useSemanticFallback: body.useSemanticFallback !== false
        });

        return NextResponse.json(
            {
                scope: "full_catalog",
                query,
                count: search.results.length,
                totalMatches: search.totalMatches,
                semanticFallbackUsed: search.semanticFallbackUsed,
                results: search.results
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        console.error("[CATALOG SEARCH] Error:", error);
        return NextResponse.json(
            { error: "Внутренняя ошибка поиска: " + (error.message || error) },
            { status: 500, headers: corsHeaders }
        );
    }
}
