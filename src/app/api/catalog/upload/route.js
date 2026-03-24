import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';
import { parseCatalog } from '@/lib/catalog-parser';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 минут для больших файлов

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

function normalizeProductsForDb(products) {
    const normalized = [];
    const skuIndex = new Map();
    const runSeed = Date.now();
    let duplicatesMerged = 0;

    for (let i = 0; i < products.length; i += 1) {
        const p = products[i] || {};
        const rawSku = String(p.sku || '').trim();
        const sku = rawSku || `no-sku-${runSeed}-${i}`;

        const record = {
            sku,
            name: String(p.name || '').trim(),
            category: String(p.category || '').trim(),
            description: String(p.description || '').trim(),
            price: Number(p.price || 0),
            attributes: p.attributes && typeof p.attributes === 'object' ? p.attributes : {},
            raw_text: String(p.raw_text || '').trim(),
            embedding: null
        };

        if (skuIndex.has(sku)) {
            const existingIndex = skuIndex.get(sku);
            normalized[existingIndex] = record;
            duplicatesMerged += 1;
            continue;
        }

        skuIndex.set(sku, normalized.length);
        normalized.push(record);
    }

    return { normalized, duplicatesMerged };
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
        console.log('[UPLOAD] Начало загрузки каталога');
        const formData = await req.formData();
        const file = formData.get('file');
        const replace = formData.get('replace');

        if (!file) {
            return NextResponse.json({ error: "Файл не найден" }, { status: 400, headers: corsHeaders });
        }

        console.log(`[UPLOAD] Файл: ${file.name}, размер: ${(file.size / 1024 / 1024).toFixed(2)}MB, режим замены: ${replace}`);

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
            console.log('[UPLOAD] Начало парсинга файла...');
            products = parseCatalog(buffer, type);
            console.log(`[UPLOAD] Распарсено товаров: ${products.length}`);
        } catch (e) {
            console.error('[UPLOAD] Ошибка парсинга:', e);
            return NextResponse.json({ error: "Ошибка парсинга файла: " + e.message }, { status: 400, headers: corsHeaders });
        }

        if (products.length === 0) {
            return NextResponse.json({ error: "Файл пуст или не содержит корректных данных" }, { status: 400, headers: corsHeaders });
        }

        const { normalized: dbProducts, duplicatesMerged } = normalizeProductsForDb(products);

        if (dbProducts.length === 0) {
            return NextResponse.json({ error: "После нормализации не осталось валидных записей" }, { status: 400, headers: corsHeaders });
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
                console.log('[UPLOAD] Начало фоновой обработки');
                // Проверяем флаг замены (поддерживаем разные форматы)
                const shouldReplace = replace === 'true' || replace === true || replace === '1';
                
                if (shouldReplace) {
                    console.log('[UPLOAD] Режим замены активирован');
                    // Создаём резервную копию перед удалением
                    backupProducts = await readAllProductsForBackup();
                    console.log(`[UPLOAD] Создана резервная копия: ${backupProducts.length} товаров`);
                    
                    await sendEvent({ status: 'Удаление старых данных...' });

                    // Удаляем ВСЕ записи из таблицы products
                    const { error: deleteError, count } = await supabase
                        .from('products')
                        .delete()
                        .gte('id', 0); // Удаляем все записи где id >= 0 (т.е. все)
                    
                    if (deleteError) {
                        throw new Error(`Не удалось очистить старый каталог: ${deleteError.message}`);
                    }
                    
                    console.log(`[UPLOAD] Удалено записей: ${backupProducts.length}`);
                    await sendEvent({ status: `Удалено записей: ${backupProducts.length}` });
                }

                const BATCH_SIZE = 1000;
                const CONCURRENCY = 10; 
                let processedCount = 0;
                let insertedCount = 0;
                const total = dbProducts.length;
                const sourceTotal = products.length;
                let fatalError = null;

                console.log(`[UPLOAD] Начало загрузки: ${total} товаров в ${Math.ceil(total / BATCH_SIZE)} батчах`);

                // Разбиваем массив на батчи
                const batches = [];
                for (let i = 0; i < total; i += BATCH_SIZE) {
                    batches.push(dbProducts.slice(i, i + BATCH_SIZE));
                }

                // Функция для обработки одного батча
                const processBatch = async (batch) => {
                    try {
                        if (batch.length > 0) {
                            const { error: dbError } = await supabase.from('products').insert(batch);

                            if (dbError) {
                                throw new Error("Supabase DB Error: " + (dbError.message || JSON.stringify(dbError)));
                            }

                            insertedCount += batch.length;
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
                    console.log(`[UPLOAD] Обработка группы батчей ${i / CONCURRENCY + 1}/${Math.ceil(batches.length / CONCURRENCY)}`);
                    await Promise.all(group.map(batch => processBatch(batch)));

                    if (fatalError) {
                        break;
                    }
                    
                    // Отправляем прогресс чаще (после каждой группы батчей)
                    const percent = Math.min(Math.round((processedCount / total) * 100), 99);
                    console.log(`[UPLOAD] Прогресс: ${processedCount}/${total} (${percent}%)`);
                    await sendEvent({ processed: processedCount, total, percent });
                }

                if (fatalError) {
                    throw fatalError;
                }

                if (insertedCount !== total) {
                    throw new Error(`В базу записано ${insertedCount} из ${total} подготовленных товаров`);
                }

                console.log(`[UPLOAD] Успешно загружено: ${insertedCount} товаров`);
                await sendEvent({ done: true, total, sourceTotal, duplicatesMerged });

            } catch (err) {
                console.error("Upload process error:", err);

                const shouldReplace = replace === 'true' || replace === true || replace === '1';
                
                if (shouldReplace) {
                    try {
                        console.log('[UPLOAD] Восстановление резервной копии...');
                        await supabase.from('products').delete().gte('id', 0);
                        await restoreProducts(backupProducts);
                        console.log('[UPLOAD] Резервная копия восстановлена');
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
