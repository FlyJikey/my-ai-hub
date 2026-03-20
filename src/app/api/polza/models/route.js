import { NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET() {
    try {
        const polzaKey = process.env.POLZA_API_KEY;
        if (!polzaKey) {
            return NextResponse.json({ error: "API key not configured" }, { status: 500 });
        }

        const maxFetched = 500;
        let allModels = [];
        let page = 1;
        
        while (allModels.length < maxFetched) {
            const res = await fetch(`https://polza.ai/api/v1/models/catalog?limit=100&page=${page}`, {
                headers: { "Authorization": `Bearer ${polzaKey.trim()}` }
            });

            if (!res.ok) break;
            const data = await res.json();
            const models = data.data || [];
            if (models.length === 0) break;
            
            allModels = [...allModels, ...models];
            if (models.length < 100) break; // Last page
            page++;
        }

        return NextResponse.json({ data: allModels, total: allModels.length });
    } catch (error) {
        console.error("Polza Models Proxy Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
