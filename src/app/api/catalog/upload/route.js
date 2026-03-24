import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';
import { parseCatalog } from '@/lib/catalog-parser';
import { requireAuth } from '@/lib/auth';

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

async function readAllProductsForBackup() {
    const allProducts = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
            .from('products')
            .select('sku, name, category, description, price, attributes, raw_text, embedding')
            .order('id', { ascending: true })
            .range(from, to);

        if (error) {
            throw new Error(`Не удалось создать резервную копию каталога: ${error.message}`);
        }

        if (!data || data.length === 0) {
            break;
        }

        allProducts.push(...data);

        if (data.length < pageSize) {
            break;
        }

        from += pageSize;
    }

    return allProducts;
}

async function restoreProducts(products) {
    if (!products || products.length === 0) {
        return;
    }

    const chunkSize = 500;
    for (let i = 0; i < products.length; i += chunkSize) {
        const chunk = products.slice(i, i + chunkSize);
        const { error } = await supabase.from('products').insert(chunk);

        if (error) {
            throw new Error(`Не удалось восстановить резервную копию каталога: ${error.message}`);
        }
    }
}

export async function POST(req) {
    // Проверка авторизации для загрузки каталога
    const authResult = requireAuth(req);
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: 401, headers: corsHeaders });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file');
        const replace = formData.get('replace');

        if (!file) {
            return NextResponse.json({ error: "Файл не найден" }, { status: 400, headers: corsHeaders });
        }

        // Check file size (max 50MB for catalog files)
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ 
                error: `Файл слишком большой. Максимальный размер: ${MAX_FILE_SIZE / 1024 / 1024}MB` 
            }, { status: 400, headers: corsHeaders });
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

        // Используем TransformStream для отправки SSE прогресса
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        
        const sendEvent = async (data) => {
            await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Запускаем фоновую обработку
        (async () => {
            let backupProducts = [];
            try {
                if (replace === 'true') {
                    backupProducts = await readAllProductsForBackup();

                    const { error: deleteError } = await supabase.from('products').delete().neq('id', 0);
                    if (deleteError) {
                        throw new Error(`Не удалось очистить старый каталог: ${deleteError.message}`);
                    }
                }

                const BATCH_SIZE = 500;
                const CONCURRENCY = 5; 
                let processedCount = 0;
                let insertedCount = 0;
                const total = products.length;
                let fatalError = null;

                // Разбиваем массив на батчи
                const batches = [];
                for (let i = 0; i < total; i += BATCH_SIZE) {
                    batches.push(products.slice(i, i + BATCH_SIZE));
                }

                // Функция для обработки одного батча
                const processBatch = async (batch) => {
                    try {
                        const recordsToInsert = batch.map(p => ({
                            sku: p.sku,
                            name: p.name,
                            category: p.category,
                            description: p.description,
                            price: p.price,
                            attributes: p.attributes,
                            raw_text: p.raw_text,
                            embedding: null // Векторизация будет происходить позже отдельным запросом
                        }));

                        // Сохраняем в Supabase обычным insert (убрали upsert по просьбе пользователя)
                        if (recordsToInsert.length > 0) {
                            const { error: dbError } = await supabase.from('products').insert(recordsToInsert);

                            if (dbError) {
                                throw new Error("Supabase DB Error: " + (dbError.message || JSON.stringify(dbError)));
                            }

                            insertedCount += recordsToInsert.length;
                        }

                        processedCount += batch.length;

                    } catch (e) {
                        console.error("Batch processing failed:", e);
                        fatalError = e;
                    }
                };


                // Обработка батчей группами для контроля concurrency
                for (let i = 0; i < batches.length; i += CONCURRENCY) {
                    if (fatalError) {
                        break;
                    }

                    const group = batches.slice(i, i + CONCURRENCY);
                    await Promise.all(group.map(batch => processBatch(batch)));

                    if (fatalError) {
                        break;
                    }
                    
                    // Отправляем прогресс чаще (после каждой группы батчей)
                    const percent = Math.min(Math.round((processedCount / total) * 100), 99);
                    await sendEvent({ processed: processedCount, total, percent });
                }

                if (fatalError) {
                    throw fatalError;
                }

                if (insertedCount !== total) {
                    throw new Error(`В базу записано ${insertedCount} из ${total} товаров`);
                }

                await sendEvent({ done: true, total });

            } catch (err) {
                console.error("Upload process error:", err);

                if (replace === 'true') {
                    try {
                        await supabase.from('products').delete().neq('id', 0);
                        await restoreProducts(backupProducts);
                        await sendEvent({ error: `${err.message}. Предыдущий каталог восстановлен.` });
                    } catch (restoreError) {
                        console.error("Catalog restore error:", restoreError);
                        await sendEvent({ error: `${err.message}. Не удалось автоматически восстановить предыдущий каталог: ${restoreError.message}` });
                    }
                } else {
                    await sendEvent({ error: err.message });
                }
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
