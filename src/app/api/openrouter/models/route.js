import { NextResponse } from "next/server";

export const runtime = 'nodejs';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
    try {
        const apiKey = (process.env.OPENROUTER_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');

        const headers = { "Content-Type": "application/json" };
        if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
        }

        const res = await fetch("https://openrouter.ai/api/v1/models", { headers });

        if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json(
                { error: "OpenRouter API error: " + errText },
                { status: res.status, headers: corsHeaders }
            );
        }

        const data = await res.json();
        const allModels = data.data || [];

        // Filter only free models (pricing = 0 for both prompt and completion)
        const freeModels = allModels.filter(m => {
            const promptPrice = parseFloat(m.pricing?.prompt || "1");
            const completionPrice = parseFloat(m.pricing?.completion || "1");
            return promptPrice === 0 && completionPrice === 0;
        });

        // Sort: models with ":free" suffix first, then alphabetically
        freeModels.sort((a, b) => {
            const aFree = a.id.includes(":free") ? 0 : 1;
            const bFree = b.id.includes(":free") ? 0 : 1;
            if (aFree !== bFree) return aFree - bFree;
            return a.name.localeCompare(b.name);
        });

        return NextResponse.json({ data: freeModels, total: freeModels.length }, { headers: corsHeaders });

    } catch (error) {
        console.error("OpenRouter models error:", error);
        return NextResponse.json(
            { error: "Failed to fetch OpenRouter models: " + error.message },
            { status: 500, headers: corsHeaders }
        );
    }
}
