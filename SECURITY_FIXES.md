# Исправления безопасности и оптимизации

Этот документ описывает внесенные изменения для улучшения безопасности и производительности проекта.

## Выполненные исправления

### 1. ✅ Создан .env.example
**Файл:** `.env.example`

Добавлен шаблон переменных окружения с комментариями для быстрого старта новых разработчиков.

### 2. ✅ Исправлена SSRF уязвимость в proxy/fetch
**Файл:** `src/app/api/proxy/fetch/route.js`

**Проблема:** URL из query-параметра передавался напрямую в fetch без валидации, что позволяло запрашивать внутренние адреса (localhost, metadata endpoints, приватные IP).

**Исправление:**
- Добавлена валидация протокола (только http/https)
- Блокировка localhost, приватных IP-диапазонов (10.x, 192.168.x, 172.16-31.x)
- Блокировка cloud metadata endpoints (169.254.169.254, metadata.google.internal)
- Отключены автоматические редиректы (`redirect: 'manual'`)

### 3. ✅ Унифицированы домены Polza API
**Файлы:** 
- Создан `src/lib/polza-client.js`
- Обновлен `.env.example`

**Проблема:** В разных роутах использовались разные домены (`polza.ai/api/v1` и `api.polza.ai/v1`), что создавало несогласованность.

**Исправление:**
- Создан централизованный клиент `polza-client.js` с функциями `createEmbeddings()`, `chatCompletions()`, `getBalance()`, `getModels()`
- Добавлена переменная окружения `POLZA_BASE_URL` (по умолчанию `https://polza.ai/api/v1`)
- Все обращения к Polza теперь должны идти через этот клиент

### 4. ✅ Оптимизирован stats API
**Файлы:**
- `src/app/api/catalog/stats/route.js`
- `supabase-migrations/count_distinct_categories.sql`

**Проблема:** Подсчет уникальных категорий выполнялся через выборку всех строк в Node.js и dedupe через Set.

**Исправление:**
- Создана SQL-функция `count_distinct_categories()` для подсчета на стороне БД
- Добавлен fallback на старый метод, если функция не создана
- Миграция SQL доступна в `supabase-migrations/`

### 5. ✅ Добавлена проверка размера файлов
**Файлы:**
- `src/app/api/catalog/upload/route.js` (макс. 50MB)
- `src/app/api/ai/vision/route.js` (макс. 10MB)

**Проблема:** Отсутствие ограничений на размер входящих файлов создавало риск OOM и DoS.

**Исправление:**
- Каталоги: максимум 50MB
- Изображения: максимум 10MB
- Проверка выполняется до чтения `arrayBuffer()`

### 6. ✅ Добавлена базовая авторизация на admin-endpoints
**Файлы:**
- Создан `src/lib/auth.js`
- Обновлены `src/app/api/settings/route.js`, `src/app/api/logs/route.js`, `src/app/api/catalog/upload/route.js`
- Обновлен `.env.example`

**Проблема:** Изменяющие endpoints (POST/DELETE) были доступны без авторизации.

**Исправление:**
- Создана функция `requireAuth()` для проверки Bearer токена
- Добавлена переменная окружения `API_SECRET_KEY` (опционально для backward compatibility)
- Защищены endpoints: POST /api/settings, DELETE /api/logs, POST /api/catalog/upload
- Если `API_SECRET_KEY` не установлен - выводится warning, но доступ разрешен (для совместимости)

**Использование:**
```bash
# В .env.local добавьте:
API_SECRET_KEY=your-secret-token-here

# При запросах к защищенным endpoints:
Authorization: Bearer your-secret-token-here
```

## Рекомендации для production

1. **Обязательно установите `API_SECRET_KEY`** в production окружении
2. **Выполните SQL-миграцию** для оптимизации stats: `supabase-migrations/count_distinct_categories.sql`
3. **Настройте CORS whitelist** вместо wildcard (см. оставшиеся задачи)
4. **Добавьте rate limiting** на дорогие AI-endpoints
5. **Ротируйте все API ключи**, если они были закоммичены в репозиторий

## Оставшиеся задачи (низкий приоритет)

- Убрать дублирование provider-веток в `ai/text/route.js`
- Улучшить CORS: whitelist вместо wildcard
- Рефакторинг крупных клиентских компонентов (600+ строк)
- Добавить rate limiting middleware

## Как применить изменения

1. Скопируйте `.env.example` в `.env.local` и заполните значения
2. Выполните SQL из `supabase-migrations/count_distinct_categories.sql` в Supabase SQL Editor
3. Перезапустите dev-сервер: `npm run dev`
4. Для защищенных endpoints используйте заголовок `Authorization: Bearer <API_SECRET_KEY>`
