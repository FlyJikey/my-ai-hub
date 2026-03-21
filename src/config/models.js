export const AI_MODELS = {
    text: [
        // === БЕСПЛАТНЫЕ ===
        {
            id: "llama-3.3-70b-versatile",
            provider: "groq",
            name: "Llama 3.3 70B",
            description: "Мощная модель Meta, отличное качество. (бесплатно)",
            tier: "free"
        },
        {
            id: "qwen/qwen3-32b",
            provider: "groq",
            name: "Qwen 3 32B",
            description: "Новейшая модель, отличная для текстов. (бесплатно)",
            tier: "free"
        },
        {
            id: "meta-llama/llama-4-scout-17b-16e-instruct",
            provider: "groq",
            name: "Llama 4 Scout 17B",
            description: "Модель Meta 4-го поколения. (бесплатно)",
            tier: "free"
        },
        {
            id: "meta-llama/llama-4-maverick-17b-128e-instruct",
            provider: "groq",
            name: "Llama 4 Maverick 17B",
            description: "Самая мощная бесплатная Llama 4. (бесплатно)",
            tier: "free"
        },
        {
            id: "llama-3.1-8b-instant",
            provider: "groq",
            name: "Llama 3.1 8B",
            description: "Самая быстрая модель, мгновенный ответ. (бесплатно)",
            tier: "free"
        },
        // === ПЛАТНЫЕ МОЩНЫЕ (Polza.ai) ===
        {
            id: "openai/gpt-4o-mini",
            provider: "polza",
            name: "GPT-4o Mini",
            description: "Новейшая мини-модель OpenAI. Polza.ai (Платно)",
            tier: "premium"
        },
        {
            id: "openai/gpt-4o",
            provider: "polza",
            name: "GPT-4o",
            description: "Мощная проверенная модель OpenAI. Polza.ai (Платно)",
            recommended: true,
            tier: "premium"
        },
        {
            id: "anthropic/claude-3.5-haiku",
            provider: "polza",
            name: "Claude 3.5 Haiku",
            description: "Умная и быстрая модель Anthropic. Polza.ai (Платно)",
            tier: "premium"
        },
        {
            id: "anthropic/claude-3.5-sonnet",
            provider: "polza",
            name: "Claude 3.5 Sonnet",
            description: "Лучшая модель Anthropic для работы с текстом. Polza.ai (Платно)",
            tier: "premium"
        },
        {
            id: "deepseek/deepseek-chat",
            provider: "polza",
            name: "DeepSeek V3",
            description: "Отличная китайская модель. Polza.ai (Платно)",
            tier: "economy"
        }
    ],
    vision: [
        // === БЕСПЛАТНЫЕ ===
        {
            id: "nvidia/nemotron-nano-12b-v2-vl:free",
            provider: "openrouter",
            name: "Nemotron 12B Vision",
            description: "Бесплатная модель Nvidia для фото. OpenRouter",
            tier: "free"
        },
        {
            id: "google/gemma-3-12b-it:free",
            provider: "openrouter",
            name: "Gemma 3 12B Vision",
            description: "Быстрая бесплатная Google модель. OpenRouter",
            tier: "free"
        },
        // === ПЛАТНЫЕ (Polza.ai) ===
        {
            id: "openai/gpt-4o-mini",
            provider: "polza",
            name: "GPT-4o Mini Vision",
            description: "Баланс цены и качества. Polza.ai (Платно)",
            recommended: true,
            tier: "premium"
        },
        {
            id: "google/gemini-2.5-flash",
            provider: "polza",
            name: "Gemini 2.5 Flash Vision",
            description: "Быстрая и дешевая Vision от Google. Polza.ai (Платно)",
            tier: "economy"
        },
        {
            id: "openai/gpt-4o",
            provider: "polza",
            name: "GPT-4o Vision",
            description: "Максимально точная модель. Polza.ai (Платно)",
            tier: "premium"
        }
    ]
};
