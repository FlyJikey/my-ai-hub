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
            // Merge custom models with potentially updated default models
            const dbSettings = data.data;
            const customTextModels = (dbSettings.textModels || []).filter(m => m.isCustom);
            const customVisionModels = (dbSettings.visionModels || []).filter(m => m.isCustom);

            // Re-map defaults to pick up any changes from config/models.js, but retain "enabled" state from DB
            const defaultTextModels = AI_MODELS.text.map(defaultModel => {
                const dbInfo = (dbSettings.textModels || []).find(m => m.id === defaultModel.id);
                return { ...defaultModel, enabled: dbInfo ? dbInfo.enabled : true };
            });

            const defaultVisionModels = AI_MODELS.vision.map(defaultModel => {
                const dbInfo = (dbSettings.visionModels || []).find(m => m.id === defaultModel.id);
                return { ...defaultModel, enabled: dbInfo ? dbInfo.enabled : true };
            });

            // Merge scenarios same way
            const customScenarios = (dbSettings.scenarios || []).filter(s => s.id.startsWith('sc_'));
            const defaultScens = DEFAULT_SCENARIOS.map(defaultScen => {
                const dbInfo = (dbSettings.scenarios || []).find(s => s.id === defaultScen.id);
                return { ...defaultScen, enabled: dbInfo ? dbInfo.enabled : true };
            });

            return NextResponse.json({
                textModels: [...defaultTextModels, ...customTextModels],
                visionModels: [...defaultVisionModels, ...customVisionModels],
                scenarios: [...defaultScens, ...customScenarios]
            }, { headers: corsHeaders });
        }

        // Initialize default if not exists
        const defaultSettings = {
            textModels: AI_MODELS.text.map(m => ({ ...m, enabled: true })),
            visionModels: AI_MODELS.vision.map(m => ({ ...m, enabled: true })),
            scenarios: DEFAULT_SCENARIOS
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
