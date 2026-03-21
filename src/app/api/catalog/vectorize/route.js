import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60; // Максимальное время для Vercel Pro

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req) {
    try {
        const polzaKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
        if (!polzaKey) {
            return NextResponse.json({ error: "Ключ POLZA_API_KEY не установлен на сервере" }, { status: 500, headers: corsHeaders });
        }

        // Подсчитываем, сколько всего элементов нужно векторизовать
        const { count: totalToVectorize, error: countError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .is('embedding', null);

        if (countError) throw new Error("Ошибка БД при подсчете: " + countError.message);

        if (totalToVectorize === 0) {
            return NextResponse.json({ message: "Нет товаров для векторизации", total: 0 }, { headers: corsHeaders });
        }

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        
        const sendEvent = async (data) => {
            await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        (async () => {
            let processed = 0;
            const BATCH_SIZE = 100;
            let isRunning = true;

            try {
                // Уведомим клиента о старте
                await sendEvent({ status: "started", total: totalToVectorize, processed: 0 });

                while (isRunning) {
                    // Достаем пачку не векторизованных товаров
                    const { data: batch, error: fetchError } = await supabase
                        .from('products')
                        .select('id, raw_text')
                        .is('embedding', null)
                        .limit(BATCH_SIZE);

                    if (fetchError) throw new Error("Ошибка выборки: " + fetchError.message);
                    
                    if (!batch || batch.length === 0) {
                        break; // Все готово
                    }

                    const inputs = batch.map(p => p.raw_text);

                    // Стучимся в Polza.ai
                    const res = await fetch("https://polza.ai/api/v1/embeddings", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${polzaKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: "text-embedding-3-small",
                            input: inputs
                        })
                    });

                    if (!res.ok) {
                        const errText = await res.text();
                        throw new Error("Polza API Error: " + errText);
                    }

                    const json = await res.json();
                    const embeddings = json.data;

                    // Обновляем товары в базе
                    for (let i = 0; i < batch.length; i++) {
                        const embedObj = embeddings.find(e => e.index === i);
                        if (embedObj && embedObj.embedding) {
                            const { error: updateError } = await supabase
                                .from('products')
                                .update({ embedding: embedObj.embedding })
                                .eq('id', batch[i].id);
                                
                            if (updateError) {
                                console.error(`Ошибка обновления ID ${batch[i].id}:`, updateError);
                            }
                        }
                    }

                    processed += batch.length;
                    
                    // Шлем прогресс
                    const percent = Math.min(Math.round((processed / totalToVectorize) * 100), 99);
                    await sendEvent({ processed, total: totalToVectorize, percent });
                }

                await sendEvent({ done: true, total: totalToVectorize });

            } catch (err) {
                console.error("Vectorize process error:", err);
                try { await sendEvent({ error: err.message }); } catch(e){}
            } finally {
                try { await writer.close(); } catch(e){}
            }
        })();

        return new NextResponse(readable, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (error) {
        console.error("Vectorize handler error:", error);
        return NextResponse.json({ error: "Внутренняя ошибка обработки: " + error.message }, { status: 500, headers: corsHeaders });
    }
}
