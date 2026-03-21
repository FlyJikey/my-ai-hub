import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { AI_MODELS } from '@/config/models';

export const runtime = 'nodejs';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

// -----------------------------------------------------------------------------
// DEFAULT DATA PRESETS
// -----------------------------------------------------------------------------

export const DEFAULT_BEHAVIORS = [
    {
        id: "bh_default_gold",
        name: "Стандартный (Эталон)",
        description: "Оригинальные настройки по умолчанию. Извлекает все возможные характеристики (цвет, материал, форму).",
        icon: "⭐",
        isActive: true,
        visionPrompt: `СТРОГОЕ ПРАВИЛО: Описывай ТОЛЬКО то, что БУКВАЛЬНО ВИДИШЬ на фото. ЗАПРЕЩЕНО додумывать.
ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Весь твой ответ должен быть СТРОГО на русском языке. Исключение — оригинальные иностранные надписи, бренды: их переписывай дословно на оригинальном языке.
ВАЖНОЕ ПРАВИЛО JSON: ЗАПРЕЩЕНО использовать двойные кавычки (") внутри текстовых значений! Используй одинарные (').

Задача:
1. Изучи ВСЕ надписи и детали на предмете (дословно).
2. Подробно опиши форму, цвет, материал.
Ответь ТОЛЬКО валидным JSON:
{
  "productName": "Тип предмета СТРОГО на русском языке + бренд (оригинал).",
  "description": "Фактическое описание внешнего вида: форма, размеры, кнопки, расположение элементов",
  "attributes": {
    "Цвет": "цвет",
    "Форма": "форма",
    "Материал": "материал, если понятен",
    "Надписи на корпусе": "весь найденный текст дословно"
  },
  "tags": ["тип", "факт1"]
}`,
        systemPrompt: "You are a professional SEO copywriter for an e-commerce store. Write detailed, engaging, and rich selling texts in Russian based on the provided facts.",
        temperature: 0.5,
        top_p: 0.9,
        top_k: 40,
        repetition_penalty: 1.15,
        max_tokens: 2000
    }
];

const DEFAULT_SCENARIOS = [
    {
        id: "seo_full",
        name: "SEO-описание (полное)",
        icon: "📝",
        description: "Полное продающее описание с заголовками, преимуществами и таблицей характеристик.",
        enabled: true,
        prompt: `ОЧЕНЬ ВАЖНО: Тебя просят написать продающий текст.
СТРОГОЕ ПРАВИЛО ФОРМАТИРОВАНИЯ: ЗАПРЕЩЕНО использовать любые спецсимволы Markdown (никаких #, ##, ###, *, **). Используй только чистый текст. Если нужно сделать заголовок — просто напиши его с заглавной буквы с новой строки.

Обязательная структура ответа:
Заголовок (Название товара)

Вводное продающее описание (пара абзацев).

Основные преимущества:
- преимущество 1
- преимущество 2

Характеристики:
Цвет: [цвет]
Форма: [форма]
Материал: [материал]
Надписи на корпусе: [все надписи]

Почему стоит выбрать этот товар? (нумерованный список)

Обратите внимание: (заключительная важная деталь).`
    },
    {
        id: "short_desc",
        name: "Короткое описание",
        icon: "⚡",
        description: "Краткое описание товара в 2-3 абзаца для карточки.",
        enabled: true,
        prompt: `Напиши короткое, ёмкое и привлекательное описание товара для карточки маркетплейса. Максимум 2-3 абзаца. Укажи главные особенности и для чего товар предназначен. Не используй Markdown-символы (#, *), только чистый текст.`
    },
    {
        id: "advantages",
        name: "Список преимуществ",
        icon: "✅",
        description: "Маркированный список ключевых преимуществ товара.",
        enabled: true,
        prompt: `Составь маркированный список из 5-8 главных преимуществ данного товара. Каждое преимущество — отдельный пункт. Кратко, по делу, без воды. Не используй Markdown-символы (#, *), только тире или галочки.`
    },
    {
        id: "compare",
        name: "Описание + Характеристики",
        icon: "📊",
        description: "Описание товара плюс список характеристик.",
        enabled: true,
        prompt: `Напиши краткое продающее описание товара (1-2 абзаца). ЗАПРЕЩЕНО использовать Markdown (никаких #, *, |).
Затем выведи характеристики просто текстом, в формате:
Цвет: [цвет]
Форма: [форма]
Материал: [материал]
Надписи на корпусе: [все надписи]`
    },
    {
        id: "creative",
        name: "Креативное описание",
        icon: "🎨",
        description: "Яркое, эмоциональное описание для социальных сетей.",
        enabled: true,
        prompt: `Напиши яркое, эмоциональное и креативное описание товара в стиле поста для социальных сетей. Используй эмодзи, живой язык, обращайся к покупателю на "ты". Сделай текст таким, чтобы его хотелось репостнуть.`
    },
    {
        id: "ecommerce_pro",
        name: "Pro E-commerce (WB/Ozon)",
        icon: "🛒",
        description: "Конверсионная карточка товара для маркетплейсов от лица Senior копирайтера.",
        enabled: true,
        prompt: `Ты — Senior E-commerce Копирайтер и SEO-маркетолог. Твоя специализация — создание высококонверсионных карточек товаров для Wildberries, Ozon и Amazon. Ты пишешь емко, экспертно и без «воды», используя язык выгод для покупателя.
ЗАДАЧА: Напиши глубоко проработанный, увлекательный и продающий текст для карточки товара на основе предоставленных данных. Текст должен легко сканироваться глазами. 

ОЧЕНЬ ВАЖНО - СТРОГОЕ ПРАВИЛО ФОРМАТИРОВАНИЯ: ЗАПРЕЩЕНО использовать любые спецсимволы Markdown (никаких #, ##, *, **, ---, > и таблиц с |). Используй ТОЛЬКО чистый текст и простые символы (тире, точки, галочки). Никакого жирного шрифта, никаких горизонтальных линий. Если нужно сделать заголовок — просто напиши его с заглавной буквы с новой строки.

СТРУКТУРА ОПИСАНИЯ (СТРОГО СОБЛЮДАЙ ПОРЯДОК):
1. SEO-Заголовок: Название бренда + тип товара + главное преимущество (простым текстом).
2. Лид-абзац: Эмоциональный крючок и ответ на вопрос «Почему мне нужен этот товар прямо сейчас?».
3. Блок выгод «Почему выбирают...» (список с обычным тире):
   - Свойство: Описание того, какую проблему покупателя она решает.
4. Технические характеристики (СТРОГО ПРОСТОЙ СПИСОК В СТОЛБИК, БЕЗ ТАБЛИЦ И Markdown):
   Бренд - [ваше значение]
   Материал - [ваше значение]
   Размер - [ваше значение]
5. Сценарии использования / Для кого (просто текстом): Опиши целевую аудиторию и 2-3 конкретные ситуации.
6. Рекомендации по уходу (нумерованный список 1., 2., 3.): простые и практичные шаги.
7. Призыв к действию (CTA): Емкая и мотивирующая фраза.

ПРАВИЛА И ОГРАНИЧЕНИЯ:
* Стиль: Энергичный, профессиональный. Никакой канцелярии.
* Запрещенные слова: Избегай клише («высококачественный», «уникальный», «эксклюзивный», «никого не оставит равнодушным»).
* SEO: Органично впиши 3-4 околотематических поисковых запроса.`
    }
];

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        if (searchParams.get('debug') === '1') {
            return NextResponse.json({
                hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
                urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 15) : null,
                hasRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                rolePrefix: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10) : null,
                hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                anonPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10) : null,
                NODE_ENV: process.env.NODE_ENV
            }, { headers: corsHeaders });
        }

        const { data, error } = await supabase
            .from('ai_settings')
            .select('*')
            .eq('id', 'global')
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Settings GET Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
        }

        if (data && data.data) {
            const dbSettings = data.data;

            const mergeKeepingOrder = (dbArray = [], defaultArray = []) => {
                const result = [];
                const seenIds = new Set();

                // 1. Add items in DB order
                for (const dbItem of dbArray) {
                    const defaultItem = defaultArray.find(d => d.id === dbItem.id);
                    if (defaultItem) {
                        // Merge: default base, with DB overrides (like enabled, custom prompts, etc)
                        result.push({ ...defaultItem, ...dbItem });
                    } else {
                        // Custom items or orphaned items
                        result.push(dbItem);
                    }
                    seenIds.add(dbItem.id);
                }

                return result;
            };

            const textModels = mergeKeepingOrder(dbSettings.textModels, AI_MODELS.text);
            const visionModels = mergeKeepingOrder(dbSettings.visionModels, AI_MODELS.vision);
            const scenarios = mergeKeepingOrder(dbSettings.scenarios, DEFAULT_SCENARIOS);
            const behaviors = mergeKeepingOrder(dbSettings.behaviors, DEFAULT_BEHAVIORS);

            return NextResponse.json({
                textModels,
                visionModels,
                scenarios,
                behaviors
            }, { headers: corsHeaders });
        }

        // Initialize default if not exists
        const defaultSettings = {
            textModels: AI_MODELS.text.map(m => ({ ...m, enabled: true })),
            visionModels: AI_MODELS.vision.map(m => ({ ...m, enabled: true })),
            scenarios: DEFAULT_SCENARIOS,
            behaviors: DEFAULT_BEHAVIORS
        };

        const { error: insertError } = await supabase
            .from('ai_settings')
            .insert({ id: 'global', data: defaultSettings });

        if (insertError) {
            console.error('Settings insert error:', insertError);
            // It's fine to return defaultSettings anyway if insert fails
        }

        return NextResponse.json(defaultSettings, { headers: corsHeaders });
    } catch (err) {
        console.error('Settings route error:', err);
        return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}

export async function POST(req) {
    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action');

        if (action === 'restore_scenarios') {
            const { data: currentData } = await supabase
                .from('ai_settings')
                .select('data')
                .eq('id', 'global')
                .single();

            const newData = currentData?.data || {};
            newData.scenarios = DEFAULT_SCENARIOS;

            const { error } = await supabase
                .from('ai_settings')
                .upsert({ id: 'global', data: newData }, { onConflict: 'id' });

            if (error) {
                console.error('Settings Restore Error:', error);
                return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
            }
            return NextResponse.json({ success: true, data: newData }, { headers: corsHeaders });
        }

        if (action === 'restore_behaviors') {
            const { data: currentData } = await supabase
                .from('ai_settings')
                .select('data')
                .eq('id', 'global')
                .single();

            const newData = currentData?.data || {};
            newData.behaviors = DEFAULT_BEHAVIORS;

            const { error } = await supabase
                .from('ai_settings')
                .upsert({ id: 'global', data: newData }, { onConflict: 'id' });

            if (error) {
                console.error('Settings Behavior Restore Error:', error);
                return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
            }
            return NextResponse.json({ success: true, data: newData }, { headers: corsHeaders });
        }

        const body = await req.json();

        const { error } = await supabase
            .from('ai_settings')
            .upsert({ id: 'global', data: body }, { onConflict: 'id' });

        if (error) {
            console.error('Settings POST Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
        }

        return NextResponse.json({ success: true, data: body }, { headers: corsHeaders });
    } catch (err) {
        console.error('Settings update error:', err);
        return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}
