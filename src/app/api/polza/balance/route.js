import { NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET() {
    try {
        const polzaKey = process.env.POLZA_API_KEY;
        if (!polzaKey) {
            return NextResponse.json({ error: "API key not configured" }, { status: 500 });
        }

        const res = await fetch("https://polza.ai/api/v1/balance", {
            headers: {
                "Authorization": `Bearer ${polzaKey.trim()}`
            }
        });

        if (!res.ok) {
            const error = await res.json();
            return NextResponse.json(error, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Polza Balance Proxy Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
