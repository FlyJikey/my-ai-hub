import { NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function POST(req) {
    try {
        const { text } = await req.json();
        if (!text) return NextResponse.json({ title: "New Chat" });

        const groqKey = process.env.GROQ_API_KEY;
        const polzaKey = process.env.POLZA_API_KEY;

        const messages = [
            { 
                role: "system", 
                content: "Generate a very short, concise title (MAX 3-4 words) in Russian for a chat that starts with the given user message. Return ONLY the title text, no quotes or punctuation." 
            },
            { role: "user", content: text }
        ];

        // 1. Try Groq First (Free & Fast)
        if (groqKey) {
            try {
                const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${groqKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: messages,
                        temperature: 0.5,
                        max_tokens: 20
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    const title = data.choices[0].message.content.trim().replace(/^"|"$/g, '');
                    return NextResponse.json({ title });
                }
            } catch (e) {
                console.error("Groq title generation failed, falling back...", e);
            }
        }

        // 2. Fallback to Polza (Paid)
        if (polzaKey) {
            try {
                const res = await fetch("https://polza.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${polzaKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "openai/gpt-4o-mini",
                        messages: messages,
                        temperature: 0.5,
                        max_tokens: 20
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    const title = data.choices[0].message.content.trim().replace(/^"|"$/g, '');
                    return NextResponse.json({ title });
                }
            } catch (e) {
                console.error("Polza title generation failed", e);
            }
        }

        return NextResponse.json({ title: "New Chat" });
    } catch (error) {
        console.error("Title generation error:", error);
        return NextResponse.json({ title: "New Chat" });
    }
}
