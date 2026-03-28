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
        const apiKey = (process.env.HUGGINGFACE_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');

        if (!apiKey) {
            return NextResponse.json(
                { error: "HUGGINGFACE_API_KEY not configured" },
                { status: 500, headers: corsHeaders }
            );
        }

        // Fetch serverless inference models (free tier)
        // HuggingFace Inference API provides free models for text-generation and image-text-to-text
        const textRes = await fetch(
            "https://huggingface.co/api/models?pipeline_tag=text-generation&inference=warm&sort=likes&direction=-1&limit=50",
            { headers: { "Authorization": `Bearer ${apiKey}` } }
        );

        const visionRes = await fetch(
            "https://huggingface.co/api/models?pipeline_tag=image-text-to-text&inference=warm&sort=likes&direction=-1&limit=30",
            { headers: { "Authorization": `Bearer ${apiKey}` } }
        );

        const textModels = textRes.ok ? await textRes.json() : [];
        const visionModels = visionRes.ok ? await visionRes.json() : [];

        // Format models for our system
        const formatted = [
            ...textModels.map(m => ({
                id: m.id || m.modelId,
                name: (m.id || m.modelId).split('/').pop(),
                fullName: m.id || m.modelId,
                type: "text",
                likes: m.likes || 0,
                downloads: m.downloads || 0,
                pipeline_tag: m.pipeline_tag,
            })),
            ...visionModels.map(m => ({
                id: m.id || m.modelId,
                name: (m.id || m.modelId).split('/').pop(),
                fullName: m.id || m.modelId,
                type: "vision",
                likes: m.likes || 0,
                downloads: m.downloads || 0,
                pipeline_tag: m.pipeline_tag,
            }))
        ];

        return NextResponse.json({ data: formatted, total: formatted.length }, { headers: corsHeaders });

    } catch (error) {
        console.error("HuggingFace models error:", error);
        return NextResponse.json(
            { error: "Failed to fetch HuggingFace models: " + error.message },
            { status: 500, headers: corsHeaders }
        );
    }
}
