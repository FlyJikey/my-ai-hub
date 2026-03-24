import { NextResponse } from "next/server";

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
        const askUrl = new URL("/api/catalog/ask", req.url);
        const response = await fetch(askUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: body.message,
                history: body.history || [],
                provider: body.provider || "polza",
                modelId: body.modelId || body.model || "deepseek/deepseek-chat",
                style: body.style || "normal"
            })
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({ error: data.error || "Ошибка каталога" }, { status: response.status, headers: corsHeaders });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: data.result })}\n\n`));
                controller.close();
            }
        });

        return new NextResponse(stream, {
            headers: {
                ...corsHeaders,
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive"
            }
        });
    } catch (error) {
        console.error("[CATALOG CHAT] Error:", error);
        return NextResponse.json(
            { error: "Внутренняя ошибка чата каталога" },
            { status: 500, headers: corsHeaders }
        );
    }
}
