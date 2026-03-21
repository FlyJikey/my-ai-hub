import { NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function POST(req) {
    try {
        const { text } = await req.json();
        if (!text) return NextResponse.json({ title: "New Chat" });

        const polzaKey = process.env.POLZA_API_KEY;
        if (!polzaKey) return NextResponse.json({ title: "New Chat" });

        const res = await fetch("https://polza.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${polzaKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: [
                    { 
                        role: "system", 
                        content: "Generate a very short, concise title (MAX 3-4 words) in Russian for a chat that starts with the given user message. Return ONLY the title text, no quotes or punctuation." 
                    },
                    { role: "user", content: text }
                ],
                temperature: 0.5,
                max_tokens: 20
            })
        });

        if (res.ok) {
            const data = await res.json();
            const title = data.choices[0].message.content.trim().replace(/^"|"$/g, '');
            return NextResponse.json({ title });
        }

        return NextResponse.json({ title: "New Chat" });
    } catch (error) {
        console.error("Title generation error:", error);
        return NextResponse.json({ title: "New Chat" });
    }
}
