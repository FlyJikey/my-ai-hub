# Задание: Реализовать раздел "База товаров" (RAG) в Next.js проекте AI Hub Dashboard

## Контекст проекта

Проект называется **AI Hub Dashboard** — дашборд для автоматизации интернет-магазина (WB/Ozon).
Деплой на **Vercel** (Hobby план — максимальный timeout 60 сек на API route).
Стек: **Next.js 14, App Router, JavaScript (не TypeScript), CSS Modules, Supabase, Polza.ai API**.

Сайт: https://ai-hub-dashboard.vercel.app/

---

## Структура проекта (все существующие файлы)

```
src/
├── app/
│   ├── layout.js
│   ├── page.js
│   ├── globals.css
│   ├── context/
│   │   └── AppContext.js
│   └── dashboard/
│       ├── layout.js              ← боковое меню навигации
│       ├── layout.module.css
│       ├── page.js                ← сводка
│       ├── page.module.css
│       ├── settings/
│       │   ├── page.js
│       │   └── page.module.css
│       ├── analysis/
│       │   ├── page.js
│       │   └── page.module.css
│       ├── chat/
│       │   ├── page.js            ← существующий чат ИИ
│       │   └── page.module.css
│       ├── ocr/
│       │   ├── page.js
│       │   └── ocr.module.css
│       ├── generator/
│       │   ├── page.js
│       │   └── page.module.css
│       └── history/
│           ├── page.js
│           └── page.module.css
├── app/api/
│   ├── route.js
│   ├── chat/
│   │   └── route.js               ← существующий chat API
│   ├── settings/
│   │   └── route.js
│   ├── limits/
│   │   └── route.js
│   ├── logs/
│   │   └── route.js
│   ├── polza/
│   │   ├── balance/route.js
│   │   └── models/route.js
│   └── ai/
│       ├── vision/route.js
│       ├── generate/route.js
│       └── text/route.js
├── config/
│   └── models.js
├── lib/
│   ├── supabase.js
│   └── logger.js
├── middleware.js
└── scripts/
    ├── check-env.js
    ├── test-req.js
    └── check-gemini.js
```

---

## Существующие файлы — полный код

### src/lib/supabase.js

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

### src/app/api/chat/route.js (пример существующего API route — используй как образец стиля)

```javascript
import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-version, x-csrftoken, x-requested-with',
    'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req) {
    const res = await handlePost(req);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res?.headers?.set(key, value);
    });
    return res;
}

async function handlePost(req) {
    try {
        const body = await req.json();
        const selectedModel = body.model;
        const messages = body.messages;
        const temperature = body.temperature ?? 0.1;
        const max_tokens = body.max_tokens ?? 50;

        if (!selectedModel || !messages) {
            return NextResponse.json({ error: "Необходимы параметры model и messages" }, { status: 400 });
        }

        const { data: settingsData } = await supabase
            .from('ai_settings')
            .select('*')
            .eq('id', 'global')
            .single();

        const textModels = settingsData?.data?.textModels || [];
        const matchedModel = textModels.find(m => m.id === selectedModel);

        let provider = matchedModel?.provider;
        if (!provider) {
            const isGroqModel = selectedModel.startsWith('llama') || selectedModel.startsWith('mixtral') || selectedModel.startsWith('gemma');
            if (selectedModel.includes('/')) {
                provider = 'polza';
            } else if (isGroqModel) {
                provider = 'groq';
            } else {
                provider = 'polza';
            }
        }

        let apiRes;

        if (provider === 'polza') {
            const polzaKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            if (!polzaKey) return NextResponse.json({ error: "Не настроен POLZA_API_KEY" }, { status: 500 });

            apiRes = await fetch("https://polza.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${polzaKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: selectedModel, messages, temperature, max_tokens })
            });
        } else if (provider === 'groq') {
            const groqKey = (process.env.GROQ_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            if (!groqKey) return NextResponse.json({ error: "Не настроен GROQ_API_KEY" }, { status: 500 });

            apiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: selectedModel, messages, temperature, max_tokens })
            });
        } else {
            const orKey = (process.env.OPENROUTER_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
            if (!orKey) return NextResponse.json({ error: "Не настроен OPENROUTER_API_KEY" }, { status: 500 });

            apiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${orKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: selectedModel, messages, temperature, max_tokens })
            });
        }

        if (!apiRes.ok) {
            const errText = await apiRes.text();
            return NextResponse.json({ error: `Ошибка ${provider} API: ` + errText }, { status: apiRes.status });
        }

        const data = await apiRes.json();
        return NextResponse.json(data);

    } catch (error) {
        return NextResponse.json({ error: "Внутренняя ошибка: " + error.message }, { status: 500 });
    }
}
```

### src/config/models.js

```javascript
export const AI_MODELS = {
    text: [
        { id: "llama-3.3-70b-versatile", provider: "groq", name: "Llama 3.3 70B", description: "Мощная модель Meta. (бесплатно)", tier: "free" },
        { id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq", name: "Llama 4 Scout 17B", description: "Модель Meta 4-го поколения. (бесплатно)", tier: "free" },
        { id: "openai/gpt-4o", provider: "polza", name: "GPT-4o", description: "Мощная модель OpenAI. Polza.ai (Платно)", recommended: true, tier: "premium" },
        { id: "deepseek/deepseek-chat", provider: "polza", name: "DeepSeek V3", description: "Китайская модель. Polza.ai (Платно)", tier: "economy" }
    ],
    vision: [
        { id: "nvidia/nemotron-nano-12b-v2-vl:free", provider: "openrouter", name: "Nemotron 12B Vision", tier: "free" },
        { id: "openai/gpt-4o-mini", provider: "polza", name: "GPT-4o Mini Vision", recommended: true, tier: "premium" }
    ]
};
```

---

## База данных Supabase — что уже создано

В Supabase уже выполнены следующие SQL запросы:

**Таблица products:**
```sql
create extension if not exists vector;

create table products (
  id bigserial primary key,
  sku text,
  name text,
  category text,
  description text,
  price numeric,
  attributes jsonb,
  raw_text text,
  embedding vector(1536),
  created_at timestamp default now()
);
```

**Функция векторного поиска:**
```sql
create or replace function match_products(
  query_embedding vector(1536),
  match_count int default 20
)
returns table (
  id bigint,
  sku text,
  name text,
  category text,
  description text,
  price numeric,
  attributes jsonb,
  raw_text text,
  similarity float
)
language sql stable
as $$
  select
    id, sku, name, category, description, price, attributes, raw_text,
    1 - (embedding <=> query_embedding) as similarity
  from products
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

---

## Переменные окружения (уже настроены в .env.local)

```
POLZA_API_KEY=...                    # ключ Polza.ai
NEXT_PUBLIC_SUPABASE_URL=...         # URL Supabase проекта
SUPABASE_SERVICE_ROLE_KEY=...        # service role ключ Supabase
GROQ_API_KEY=...                     # ключ Groq
OPENROUTER_API_KEY=...               # ключ OpenRouter
```

---

## Polza.ai API — как использовать

**Базовый URL:** `https://polza.ai/api/v1`

**Эмбеддинги:**
```javascript
const response = await fetch("https://polza.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${process.env.POLZA_API_KEY}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        model: "text-embedding-3-small",  // размерность 1536
        input: ["текст 1", "текст 2", "текст 3"]  // массив строк
    })
});
const data = await response.json();
// data.data = [{embedding: [0.1, -0.2, ...], index: 0}, ...]
```

**Chat completions со streaming:**
```javascript
const response = await fetch("https://polza.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${process.env.POLZA_API_KEY}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [{role: "system", content: "..."}, {role: "user", content: "..."}],
        stream: true,
        temperature: 0.1,
        max_tokens: 1000
    })
});
// Читать как SSE поток
```

---

## Задание — что нужно реализовать

Создать раздел **"База товаров"** — новая страница `/dashboard/catalog`.

Пользователь загружает файл Excel/CSV/JSON с товарами (до 24 000 строк).
Система создаёт векторные эмбеддинги и сохраняет в Supabase.
После загрузки — чат-интерфейс где можно задавать вопросы по базе товаров.

---

## Файлы которые нужно создать

### Файл 1: `src/lib/catalog-parser.js`

Парсер файлов товаров.

**Входные данные:** Buffer файла + строка типа (`"xlsx"` / `"csv"` / `"json"`)

**Выходные данные:** `Array<{sku, name, category, description, price, attributes, raw_text}>`

**Логика нормализации колонок** (названия в файле могут быть разными):
- `sku` ← "Артикул" / "SKU" / "Article" / "арт" / "Арт" / "код" / "ID"
- `name` ← "Название" / "Name" / "Наименование" / "Товар" / "title"
- `category` ← "Категория" / "Category" / "Раздел" / "Тип"
- `description` ← "Описание" / "Description" / "Описание товара"
- `price` ← "Цена" / "Price" / "Стоимость" / "Цена, руб"

Всё что не попало в основные поля → идёт в `attributes` (объект `{ключ: значение}`).

`raw_text` — все поля склеены в одну строку для эмбеддинга:
```
"Артикул: 12345 | Название: Куртка синяя мужская | Категория: Верхняя одежда | Цена: 2990 | Цвет: синий | Размер: XL | Материал: полиэстер"
```

**Библиотеки:** `xlsx` (для Excel), `papaparse` (для CSV). Оба уже нужно установить через `npm install xlsx papaparse`.

---

### Файл 2: `src/app/api/catalog/stats/route.js`

GET endpoint — статистика базы товаров.

```
GET /api/catalog/stats

Ответ:
{
  "total": 24000,
  "categories": 15,
  "lastUpdated": "2026-03-21T10:00:00.000Z",
  "hasData": true
}
```

Запросы к Supabase:
- `select count(*) from products` → total
- `select count(distinct category) from products` → categories
- `select created_at from products order by created_at desc limit 1` → lastUpdated

---

### Файл 3: `src/app/api/catalog/upload/route.js`

POST endpoint — загрузка и обработка файла товаров.

```
POST /api/catalog/upload
Content-Type: multipart/form-data
Body: { file: File, replace: "true"/"false" }
```

**Алгоритм:**
1. Получить файл из `formData`
2. Определить тип по расширению файла
3. Преобразовать в Buffer (`await file.arrayBuffer()` → `Buffer.from(...)`)
4. Вызвать `catalogParser(buffer, type)` → массив товаров
5. Если `replace === "true"` → удалить все старые записи: `supabase.from('products').delete().neq('id', 0)`
6. Разбить товары на батчи по **50 штук**
7. Стримить прогресс через SSE (`ReadableStream`)
8. Обрабатывать батчи параллельно по **5 батчей** через `Promise.all`:
   - Для каждого батча: взять `raw_text` всех товаров → отправить в Polza.ai embeddings → получить векторы → вставить в Supabase
9. После каждых 5 батчей отправлять: `data: {"processed": N, "total": M, "percent": P}\n\n`
10. В конце: `data: {"done": true, "total": M}\n\n`

**Важно:**
- `export const runtime = 'nodejs'`
- `export const maxDuration = 60`
- Если ошибка в одном батче — логировать и продолжать, не падать
- Проверить что файл не пустой

**SSE формат ответа:**
```
Content-Type: text/event-stream

data: {"processed": 250, "total": 24000, "percent": 1}

data: {"processed": 500, "total": 24000, "percent": 2}

data: {"done": true, "total": 24000}
```

---

### Файл 4: `src/app/api/catalog/search/route.js`

POST endpoint — векторный поиск по базе товаров.

```
POST /api/catalog/search
Body: { "query": "синяя куртка XL", "limit": 20 }

Ответ:
{
  "results": [
    {
      "id": 1,
      "sku": "12345",
      "name": "Куртка зимняя синяя",
      "category": "Верхняя одежда",
      "price": 2990,
      "attributes": {"Цвет": "синий", "Размер": "XL"},
      "raw_text": "...",
      "similarity": 0.92
    }
  ],
  "query": "синяя куртка XL",
  "count": 5
}
```

**Алгоритм:**
1. Получить `query` и `limit` из тела запроса
2. Создать эмбеддинг запроса через Polza.ai (`model: "text-embedding-3-small"`, `input: [query]`)
3. Вызвать Supabase RPC: `supabase.rpc('match_products', { query_embedding: vector, match_count: limit })`
4. Вернуть результаты

---

### Файл 5: `src/app/api/catalog/chat/route.js`

POST endpoint — чат с контекстом товаров, со streaming.

```
POST /api/catalog/chat
Body: {
  "message": "Есть ли синяя куртка размера XL?",
  "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
  "model": "deepseek/deepseek-chat"
}
```

**Алгоритм:**
1. Найти топ-20 товаров через внутренний поиск (вызвать логику из search, не HTTP запрос)
2. Сформировать системный промпт:
```
Ты ассистент по каталогу товаров интернет-магазина.
Отвечай ТОЛЬКО на основе данных из базы товаров ниже.
Если товар не найден — честно скажи об этом.
Указывай артикул товара в ответе.
Всегда отвечай на русском языке.

База товаров (найдено по запросу):
1. [Арт: 12345] Куртка зимняя синяя | Категория: Верхняя одежда | Цена: 2990₽ | Цвет: синий, Размер: XL
2. [Арт: 67890] Парка синяя мужская | Категория: Верхняя одежда | Цена: 4490₽ | Цвет: синий, Размер: XL, L
...
```
3. Отправить в `https://polza.ai/api/v1/chat/completions` со `stream: true`
4. Модель по умолчанию: `"deepseek/deepseek-chat"` (дешёвая и хорошая)
5. Стримить ответ клиенту через SSE

**SSE формат:**
```
data: {"chunk": "Да"}
data: {"chunk": ", нашёл"}
data: {"chunk": " 2 подходящих товара:"}
data: [DONE]
```

---

### Файл 6: `src/app/dashboard/catalog/page.js`

React компонент страницы ("use client").

**Два состояния:**

**Состояние A — база пуста (hasData = false):**
```
┌─────────────────────────────────────────┐
│  📦 База товаров                        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │   📁 Перетащите файл сюда       │   │
│  │   или нажмите для выбора        │   │
│  │                                 │   │
│  │   Поддерживается: xlsx, csv,    │   │
│  │   json                          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ☑ Заменить существующую базу           │
│                                         │
│  [  Загрузить и обработать  ]           │
│                                         │
│  ████████████░░░░░ 12 000 / 24 000     │
│  Обработано 50%...                      │
└─────────────────────────────────────────┘
```

**Состояние B — база загружена (hasData = true):**
```
┌──────────────────────────────────────────────────┐
│  📦 База товаров  ✓ 24 000 товаров               │
│  Обновлена: 21 марта 2026  [↑ Обновить базу]     │
├──────────────────────────────────────────────────┤
│                                                  │
│  🤖  База загружена! Знаю 24 000 товаров.        │
│      Спросите что угодно.                        │
│                                                  │
│  👤  Есть синяя куртка размера XL?               │
│                                                  │
│  🤖  Нашёл 2 подходящих товара:                  │
│      • Арт. 12345 — Куртка зимняя синяя XL       │
│        Цена: 2 990 ₽                            │
│      • Арт. 67890 — Парка синяя мужская XL       │
│        Цена: 4 490 ₽                            │
│                                                  │
├──────────────────────────────────────────────────┤
│  Спросите о товарах...              [Отправить]  │
└──────────────────────────────────────────────────┘
```

**Логика компонента:**
- При загрузке → `GET /api/catalog/stats` → определить состояние
- При загрузке файла → `POST /api/catalog/upload` → читать SSE поток → обновлять прогресс-бар
- После загрузки → автоматически переключиться в состояние B
- В чате → `POST /api/catalog/chat` → читать SSE → добавлять текст по мере поступления (streaming)
- Кнопка "Обновить базу" → показывает дропзону поверх чата
- История сообщений сохраняется в `localStorage` с ключом `aiHub_catalog_chat`
- Ответы ИИ рендерить через `white-space: pre-wrap`
- Enter отправляет, Shift+Enter — новая строка
- Auto-scroll вниз при новых сообщениях

---

### Файл 7: `src/app/dashboard/catalog/page.module.css`

Стили в тёмной теме, совместимые с остальным дашбордом.

**Цвета:**
- Фон страницы: `#0f1117`
- Фон карточек/панелей: `#1a1d27`
- Акцент (зелёный): `#10b981`
- Текст основной: `#e5e7eb`
- Текст второстепенный: `#6b7280`
- Граница: `#2d2f3e`
- Фон сообщения пользователя: `#1e3a5f`
- Фон сообщения ИИ: `#1a1d27`

Стиль должен совпадать с существующим чатом (`/dashboard/chat`) — те же размеры, отступы, скругления.

---

### Файл 8: изменение `src/app/dashboard/layout.js`

Добавить пункт **"База товаров"** в боковое меню навигации между "Чат ИИ" и "Анализ ИИ".

Иконка: `Package` из `lucide-react`.
Путь: `/dashboard/catalog`.

Посмотри как устроены существующие пункты меню и добавь по той же схеме.

---

## Правила кода — соблюдать обязательно

1. **Только JavaScript** — никакого TypeScript, никаких `.ts` / `.tsx` файлов
2. **Каждый API route** должен иметь:
   ```javascript
   export const runtime = 'nodejs';
   export const maxDuration = 60;
   ```
3. **CORS заголовки** в каждом route — точно как в `src/app/api/chat/route.js` выше
4. **Ключи** всегда брать так:
   ```javascript
   const polzaKey = (process.env.POLZA_API_KEY || "").trim().replace(/(^"|"$|^'|'$)/g, '');
   ```
5. **Supabase** импортировать только из `@/lib/supabase`
6. **Ошибки** — всегда через `try/catch`, возвращать понятные сообщения на русском
7. **CSS** — только CSS Modules (`.module.css`), никакого Tailwind или inline-стилей
8. **Иконки** — только из `lucide-react` (уже установлен)

---

## Установить зависимости перед началом

```bash
npm install xlsx papaparse
```

---

## Порядок написания файлов

Пиши строго по одному файлу за раз в таком порядке:

1. `src/lib/catalog-parser.js`
2. `src/app/api/catalog/stats/route.js`
3. `src/app/api/catalog/upload/route.js`
4. `src/app/api/catalog/search/route.js`
5. `src/app/api/catalog/chat/route.js`
6. `src/app/dashboard/catalog/page.js`
7. `src/app/dashboard/catalog/page.module.css`
8. Изменения в `src/app/dashboard/layout.js`

После каждого файла жди подтверждения перед следующим.

---

## Начало работы

Напиши первый файл: `src/lib/catalog-parser.js`
