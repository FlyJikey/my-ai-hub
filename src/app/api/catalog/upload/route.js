import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';
import { parseCatalog } from '@/lib/catalog-parser';

export const runtime = 'nodejs';
export const maxDuration = 60;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');
        const replace = formData.get('replace');

        if (!file) {
            return NextResponse.json({ error: "Файл не найден" }, { status: 400, headers: corsHeaders });
        }

        const fileName = file.name || "";
        const type = fileName.split('.').pop().toLowerCase();
        
        if (!['csv', 'json', 'xlsx', 'xls'].includes(type)) {
            return NextResponse.json({ error: "Неподдерживаемый формат файла" }, { status: 400, headers: corsHeaders });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Парсинг файла
        let products = [];
        try {
            products = parseCatalog(buffer, type);
        } catch (e) {
            return NextResponse.json({ error: "Ошибка парсинга файла: " + e.message }, { status: 400, headers: corsHeaders });
        }

        if (products.length === 0) {
            return NextResponse.json({ error: "Файл пуст или не содержит корректных данных" }, { status: 400, headers: corsHeaders });
        }

        const polzaKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
        if (!polzaKey) {
            return NextResponse.json({ error: "Ключ POLZA_API_KEY не установлен на сервере" }, { status: 500, headers: corsHeaders });
        }

        // Используем TransformStream для отправки SSE прогресса
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        
        const sendEvent = async (data) => {
            await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Запускаем фоновую обработку
        (async () => {
            try {
                if (replace === 'true') {
                    // Удаляем старые записи
                    await supabase.from('products').delete().neq('id', 0);
                }

                const BATCH_SIZE = 50;
                const CONCURRENCY = 5;
                let processedCount = 0;
                const total = products.length;

                // Разбиваем массив на батчи
                const batches = [];
                for (let i = 0; i < total; i += BATCH_SIZE) {
                    batches.push(products.slice(i, i + BATCH_SIZE));
                }

                // Функция для обработки одного батча
                const processBatch = async (batch) => {
                    const inputs = batch.map(p => p.raw_text);
                    
                    try {
                        // Получаем эмбеддинги
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
                            const err = await res.text();
                            console.error("Embedding API error:", err);
                            throw new Error("Polza API Error");
                        }

                        const data = await res.json();
                        const embeddings = data.data;

                        // Сопоставляем эмбеддинги с товарами
                        const recordsToInsert = batch.map((p, index) => {
                            const embedObj = embeddings.find(e => e.index === index);
                            return {
                                sku: p.sku,
                                name: p.name,
                                category: p.category,
                                description: p.description,
                                price: p.price,
                                attributes: p.attributes,
                                raw_text: p.raw_text,
                                embedding: embedObj ? embedObj.embedding : null
                            };
                        }).filter(r => r.embedding);

                        // Сохраняем в Supabase
                        if (recordsToInsert.length > 0) {
                            const { error: insertError } = await supabase.from('products').insert(recordsToInsert);
                            if (insertError) {
                                console.error("Supabase insert error:", insertError);
                            }
                        }

                        processedCount += batch.length;

                    } catch (e) {
                        console.error("Batch processing failed:", e);
                        // Продолжаем выполнение следующих батчей, даже если один упал
                        processedCount += batch.length; 
                    }
                };

                // Обработка батчей группами для контроля concurrency
                for (let i = 0; i < batches.length; i += CONCURRENCY) {
                    const group = batches.slice(i, i + CONCURRENCY);
                    await Promise.all(group.map(batch => processBatch(batch)));
                    
                    // Отправляем прогресс
                    const percent = Math.round((processedCount / total) * 100);
                    await sendEvent({ processed: processedCount, total, percent });
                }

                await sendEvent({ done: true, total });

            } catch (err) {
                console.error("Upload process error:", err);
                await sendEvent({ error: err.message });
            } finally {
                await writer.close();
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
        console.error("Handler error:", error);
        return NextResponse.json({ error: "Внутренняя ошибка обработки" }, { status: 500, headers: corsHeaders });
    }
}
