# AI Hub Dashboard

AI Hub Dashboard - веб-дашборд для автоматизации задач интернет-магазина и маркетплейсов (WB/Ozon):
- генерация SEO-текстов и названий карточек;
- AI-чат по товарам;
- анализ изображений и OCR;
- раздел "База товаров" с векторным поиском (RAG) через Supabase + embeddings.

## Технологии

- Next.js 16 (App Router), React 19, JavaScript
- CSS Modules
- Supabase (`@supabase/supabase-js`)
- AI-провайдеры: Polza.ai, Groq, OpenRouter, Gemini
- Вспомогательные библиотеки: `xlsx`, `papaparse`, `cheerio`, `react-markdown`, `remark-gfm`, `lucide-react`

## Структура проекта

```text
src/
  app/
    page.js                      # лендинг
    dashboard/                   # основной интерфейс
      page.js                    # сводка
      chat/                      # AI-чат
      generator/                 # генератор контента
      catalog/                   # база товаров (RAG)
      ocr/                       # OCR модуль
      analysis/                  # анализ результатов
      history/                   # история генераций
      settings/                  # настройки моделей и сценариев
    api/                         # backend routes (Next.js Route Handlers)
      ai/                        # text / vision / generate / embed / title
      chat/                      # чат API
      catalog/                   # upload / vectorize / search / chat / stats
      settings/                  # глобальные настройки
      limits/                    # проверка лимитов провайдеров
      logs/                      # логи API ошибок
      polza/                     # баланс и модели Polza
      proxy/fetch/               # fetch внешних страниц
  lib/
    supabase.js                  # инициализация клиента Supabase
    logger.js                    # логирование ошибок API
    catalog-parser.js            # парсинг CSV/XLSX/JSON каталога
  config/
    models.js                    # список AI-моделей по умолчанию
  scripts/
    check-env.js                 # проверка env
    check-gemini.js              # smoke-test Gemini
    test-req.js                  # тестовый запрос
```

## Быстрый старт

1. Установите зависимости:

```bash
npm install
```

2. Создайте `.env.local` и заполните переменные (см. раздел ниже).

3. Запустите dev-сервер:

```bash
npm run dev
```

4. Откройте `http://localhost:3000`.

## Переменные окружения

Минимально необходимые переменные:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

POLZA_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
```

Опционально:

```bash
GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Примечания:
- `SUPABASE_SERVICE_ROLE_KEY` используется server-side для операций записи и служебных таблиц.
- `NEXT_PUBLIC_*` переменные доступны на клиенте.
- Для production храните ключи только в секретах Vercel/CI, не в репозитории.

## Основные npm-скрипты

```bash
npm run dev     # локальная разработка
npm run build   # production-сборка
npm run start   # запуск production-сборки
npm run lint    # eslint
```

## Карта API

Ключевые роуты:

- `GET /api/settings`, `POST /api/settings` - чтение/обновление глобальных настроек моделей и сценариев
- `GET /api/limits` - статус лимитов/баланса по провайдерам
- `GET /api/logs`, `DELETE /api/logs` - просмотр/очистка логов

- `POST /api/chat` - основной чат с выбранной моделью

- `POST /api/ai/text` - генерация текста
- `POST /api/ai/vision` - анализ изображения
- `POST /api/ai/generate` - комбинированный pipeline генерации
- `POST /api/ai/embed` - получение embedding
- `POST /api/ai/title` - генерация заголовка

- `GET /api/catalog/stats` - статистика базы товаров
- `POST /api/catalog/upload` - загрузка каталога (SSE-прогресс)
- `POST /api/catalog/vectorize` - векторизация загруженных товаров (SSE-прогресс)
- `POST /api/catalog/search` - векторный поиск по товарам
- `POST /api/catalog/chat` - чат по базе товаров (streaming)

- `GET /api/polza/balance` - баланс Polza
- `GET /api/polza/models` - список моделей Polza

## Ограничения и эксплуатационные заметки

- Часть API-роутов работает с `maxDuration = 60` (ограничение Vercel Hobby).
- Загрузка крупных файлов каталога и векторизация могут быть длительными; используйте батчевую обработку.
- В проекте есть CORS middleware для `/api/*`; для production рекомендуется ограничивать список origin.
- Перед нагрузочным использованием добавьте rate limiting и авторизацию для изменяющих эндпоинтов.

## Деплой (Vercel)

1. Подключите репозиторий в Vercel.
2. В `Project Settings -> Environment Variables` задайте все переменные из раздела "Переменные окружения".
3. Выполните деплой.
4. После деплоя проверьте:
   - открывается `/dashboard`;
   - отвечает `GET /api/settings`;
   - работает генерация `POST /api/ai/text`;
   - для каталога корректно отрабатывают `stats/upload/search`.

## Диагностика типовых проблем

- `Не настроен ..._API_KEY` - отсутствует ключ провайдера в env.
- Ошибки Supabase (`PGRST...`) - проверьте URL/ключ и наличие нужных таблиц/функций.
- Пустые результаты `catalog/search` - проверьте, что каталог загружен и выполнена векторизация.
- Долгий ответ API - проверьте размер входных файлов, batch size и лимиты провайдера.
