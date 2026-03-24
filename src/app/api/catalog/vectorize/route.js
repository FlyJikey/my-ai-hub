import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
        // Получаем параметры из тела запроса
        const body = await req.json().catch(() => ({}));
        const modelId = body.model || "text-embedding-3-small";
        const provider = body.provider || "polza";
        
        console.log(`[VECTORIZE] Начало векторизации с моделью: ${modelId} (${provider})`);
        
        // Получаем API ключи в зависимости от провайдера
        let apiKey, apiUrl;
        
        if (provider === "polza") {
            apiKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            apiUrl = "https://polza.ai/api/v1/embeddings";
            if (!apiKey) {
                return NextResponse.json({ error: "Ключ POLZA_API_KEY не установлен на сервере" }, { status: 500, headers: corsHeaders });
            }
        } else if (provider === "openrouter") {
            apiKey = (process.env.OPENROUTER_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            apiUrl = "https://openrouter.ai/api/v1/embeddings";
            if (!apiKey) {
                return NextResponse.json({ error: "Ключ OPENROUTER_API_KEY не установлен на сервере" }, { status: 500, headers: corsHeaders });
            }
        } else {
            return NextResponse.json({ error: `Неподдерживаемый провайдер: ${provider}` }, { status: 400, headers: corsHeaders });
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
        
        console.log(`[VECTORIZE] Найдено товаров для векторизации: ${totalToVectorize}`);

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        
        const sendEvent = async (data) => {
            await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        (async () => {
            let processed = 0;
            let failed = 0;
            const BATCH_SIZE = 200;
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

                    // Вызываем API для векторизации
                    console.log(`[VECTORIZE] Отправка батча из ${validItems.length} товаров в ${provider}`);
                    const res = await fetch(apiUrl, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: modelId,
                            input: inputs
                        })
                    });

                    if (!res.ok) {
                        const errText = await res.text();
                        console.error(`[VECTORIZE] Ошибка API ${provider}:`, errText);
                        throw new Error(`${provider} API Error: ` + errText);
                    }

                    const json = await res.json();
                    const embeddings = json.data;
                    
                    console.log(`[VECTORIZE] Получено ${embeddings.length} векторов`);

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
                    
                    console.log(`[VECTORIZE] Обновлено в БД: ${successfulUpdates} товаров. Всего обработано: ${processed}/${totalToVectorize}`);

                    if (successfulUpdates === 0) {
                        throw new Error('Векторизация остановлена: текущая пачка не записалась в базу данных');
                    }
                    
                    // Шлем прогресс
                    const percent = Math.min(Math.round((processed / totalToVectorize) * 100), 99);
                    await sendEvent({ processed, total: totalToVectorize, percent, failed });
                }

                console.log(`[VECTORIZE] Завершено успешно: ${processed} товаров, пропущено: ${failed}`);
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
