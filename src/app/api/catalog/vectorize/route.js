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

function buildFailedIdsFilter(failedIds) {
    if (failedIds.size === 0) {
        return null;
    }

    return `(${Array.from(failedIds).join(',')})`;
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
            let failed = 0;
            const BATCH_SIZE = 100;
            const failedIds = new Set();

            try {
                // Уведомим клиента о старте
                await sendEvent({ status: "started", total: totalToVectorize, processed: 0 });

                while (true) {
                    // Достаем пачку не векторизованных товаров
                    let query = supabase
                        .from('products')
                        .select('id, raw_text')
                        .is('embedding', null)
                        .order('id', { ascending: true })
                        .limit(BATCH_SIZE);

                    const failedIdsFilter = buildFailedIdsFilter(failedIds);
                    if (failedIdsFilter) {
                        query = query.not('id', 'in', failedIdsFilter);
                    }

                    const { data: batch, error: fetchError } = await query;

                    if (fetchError) throw new Error("Ошибка выборки: " + fetchError.message);
                    
                    if (!batch || batch.length === 0) {
                        break; // Все готово
                    }

                    const validItems = batch.filter((item) => typeof item.raw_text === 'string' && item.raw_text.trim());
                    const invalidItems = batch.filter((item) => !validItems.includes(item));

                    invalidItems.forEach((item) => failedIds.add(item.id));
                    failed += invalidItems.length;

                    if (validItems.length === 0) {
                        throw new Error('Невозможно продолжить векторизацию: у выбранных товаров отсутствует raw_text');
                    }

                    const inputs = validItems.map(p => p.raw_text);

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
                    const updates = await Promise.all(validItems.map(async (item, index) => {
                        const embedObj = embeddings.find(e => e.index === index);

                        if (!embedObj?.embedding) {
                            failedIds.add(item.id);
                            failed += 1;
                            return false;
                        }

                        const { error: updateError } = await supabase
                            .from('products')
                            .update({ embedding: embedObj.embedding })
                            .eq('id', item.id);

                        if (updateError) {
                            console.error(`Ошибка обновления ID ${item.id}:`, updateError);
                            failedIds.add(item.id);
                            failed += 1;
                            return false;
                        }

                        return true;
                    }));

                    const successfulUpdates = updates.filter(Boolean).length;
                    processed += successfulUpdates;

                    if (successfulUpdates === 0) {
                        throw new Error('Векторизация остановлена: текущая пачка не записалась в базу данных');
                    }
                    
                    // Шлем прогресс
                    const percent = Math.min(Math.round((processed / totalToVectorize) * 100), 99);
                    await sendEvent({ processed, total: totalToVectorize, percent, failed });
                }

                await sendEvent({ done: true, total: totalToVectorize, processed, failed });

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
