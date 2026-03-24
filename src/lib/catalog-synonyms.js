const STOP_WORDS = new Set([
    "а",
    "без",
    "в",
    "во",
    "все",
    "всю",
    "вы",
    "выведи",
    "где",
    "да",
    "для",
    "если",
    "есть",
    "еще",
    "ещё",
    "из",
    "и",
    "или",
    "их",
    "какая",
    "какие",
    "какой",
    "какую",
    "каталог",
    "ли",
    "мне",
    "можно",
    "найди",
    "найти",
    "нам",
    "нас",
    "нужен",
    "нужна",
    "нужны",
    "о",
    "он",
    "она",
    "они",
    "покажи",
    "показать",
    "подскажи",
    "по",
    "пожалуйста",
    "позиций",
    "позиции",
    "сколько",
    "список",
    "среди",
    "тех",
    "то",
    "товар",
    "товара",
    "товаров",
    "товары",
    "у",
    "уже",
    "укажи",
    "укажите",
    "уточни",
    "хочу",
    "что",
    "чтобы",
    "это"
]);

const BRAND_ATTRIBUTE_KEYS = [
    "brand",
    "бренд",
    "марка",
    "производитель",
    "vendor",
    "manufacturer",
    "торговая марка"
];

const CONCEPTS = [
    {
        key: "charging_cable",
        aliases: [
            "кабель зарядки",
            "кабель для зарядки",
            "кабели зарядки",
            "зарядный кабель",
            "зарядные кабели",
            "провод зарядки",
            "провод для зарядки",
            "провода зарядки",
            "usb кабель",
            "usb кабели",
            "кабель usb",
            "type c кабель",
            "lightning кабель"
        ],
        tokenGroups: [
            ["кабел", "провод", "шнур", "type c", "lightning", "тайп си", "тайп-c"],
            ["заряд", "charging"]
        ]
    },
    {
        key: "power_cable",
        aliases: [
            "кабель питания",
            "провод питания",
            "силовой кабель",
            "силовой провод"
        ],
        tokenGroups: [
            ["кабел", "провод"],
            ["питан", "силов"]
        ]
    },
    {
        key: "cable_channel",
        aliases: [
            "кабель канал",
            "кабель каналы",
            "кабель каналов",
            "кабель каналу",
            "кабель-канал",
            "кабель-каналы",
            "кабельный канал",
            "кабельные каналы"
        ],
        tokenGroups: [
            ["кабел"],
            ["канал"]
        ]
    },
    {
        key: "fishing",
        aliases: [
            "рыбалка",
            "рыболовные",
            "рыболовный",
            "рыболовная",
            "для рыбалки",
            "рыболовные товары"
        ],
        tokenGroups: [["рыбал", "рыболов"]]
    },
    {
        key: "sport",
        aliases: [
            "спорт",
            "спортивные товары",
            "товары для спорта",
            "для спорта"
        ],
        tokenGroups: [["спорт", "спортив"]]
    },
    {
        key: "gps",
        aliases: [
            "gps",
            "gps маяк",
            "gps трекер",
            "gps tracker",
            "гпс",
            "джипиэс",
            "gps навигатор"
        ],
        tokenGroups: [
            ["gps", "гпс", "джипиэс", "маяк", "трекер", "tracker", "навигатор"]
        ]
    },
    {
        key: "brand_request",
        aliases: ["бренд", "бренды", "марка", "марки"],
        tokenGroups: [["бренд", "марк"]]
    }
];

function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeCatalogText(value) {
    return normalizeWhitespace(
        String(value || "")
            .toLowerCase()
            .replace(/ё/g, "е")
            .replace(/["'`]/g, " ")
            .replace(/[^\p{L}\p{N}]+/gu, " ")
    );
}

export function getAttributeValueByKeys(attributes, keys = BRAND_ATTRIBUTE_KEYS) {
    if (!attributes || typeof attributes !== "object") {
        return "";
    }

    const normalizedMap = new Map(
        Object.entries(attributes).map(([key, value]) => [normalizeCatalogText(key), value])
    );

    for (const key of keys) {
        const value = normalizedMap.get(normalizeCatalogText(key));
        if (value !== undefined && value !== null && String(value).trim()) {
            return normalizeWhitespace(value);
        }
    }

    return "";
}

export function normalizeBrandLabel(value) {
    const cleaned = normalizeWhitespace(value);
    if (!cleaned) {
        return "";
    }

    if (/^[a-z0-9 .\-_/]+$/i.test(cleaned)) {
        return cleaned
            .split(" ")
            .filter(Boolean)
            .map((part) => (/^[a-z0-9\-_/]+$/i.test(part) ? part.toUpperCase() : part))
            .join(" ");
    }

    return cleaned;
}

export function extractMeaningfulTokens(value) {
    return normalizeCatalogText(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function matchesTokenGroups(text, tokenGroups = []) {
    if (!text || tokenGroups.length === 0) {
        return false;
    }

    return tokenGroups.every((group) => group.some((token) => text.includes(token)));
}

export function getMatchedConcepts(value) {
    const normalized = normalizeCatalogText(value);

    return CONCEPTS.filter((concept) => {
        if (concept.aliases.some((alias) => normalized.includes(alias))) {
            return true;
        }

        return matchesTokenGroups(normalized, concept.tokenGroups || []);
    });
}

export function buildSearchDescriptor(value) {
    const normalizedQuery = normalizeCatalogText(value);
    const concepts = getMatchedConcepts(normalizedQuery);
    const tokens = extractMeaningfulTokens(normalizedQuery);
    const phrases = Array.from(
        new Set([
            normalizedQuery,
            ...concepts.flatMap((concept) => concept.aliases || [])
        ].filter(Boolean))
    );

    return {
        query: normalizeWhitespace(value),
        normalizedQuery,
        tokens,
        phrases,
        concepts
    };
}

export function scoreTextMatch(text, descriptor) {
    const normalizedText = normalizeCatalogText(text);

    if (!normalizedText || !descriptor) {
        return 0;
    }

    let score = 0;
    let hardMatch = false;

    for (const concept of descriptor.concepts || []) {
        if (concept.aliases.some((alias) => normalizedText.includes(alias))) {
            score += 80;
            hardMatch = true;
            continue;
        }

        if (matchesTokenGroups(normalizedText, concept.tokenGroups || [])) {
            score += 60;
            hardMatch = true;
        }
    }

    for (const phrase of descriptor.phrases || []) {
        if (phrase && phrase.length > 2 && normalizedText.includes(phrase)) {
            score += 40;
            hardMatch = true;
        }
    }

    const tokenHits = (descriptor.tokens || []).filter((token) => normalizedText.includes(token));
    score += tokenHits.length * 12;

    if (!hardMatch) {
        const minimumHits = descriptor.tokens.length <= 1 ? 1 : Math.min(2, descriptor.tokens.length);
        if (tokenHits.length < minimumHits) {
            return 0;
        }
    }

    return score;
}

export function stripCatalogNoise(value) {
    return normalizeWhitespace(
        String(value || "")
            .replace(/[?!.]+/g, " ")
            .replace(/(^|\s)(у нас|в базе|по базе|в каталоге|из базы|мне|пожалуйста|просто|вообще|сейчас)(?=\s|$)/gi, " ")
            .replace(/(^|\s)(товары|товаров|товара|позиции|позиций|ассортимент)(?=\s|$)/gi, " ")
    );
}

export function detectProductBrand(attributes, fallbackValue = "") {
    const directBrand = normalizeBrandLabel(getAttributeValueByKeys(attributes));
    if (directBrand) {
        return directBrand;
    }

    return normalizeBrandLabel(fallbackValue);
}

export function getBrandAttributeKeys() {
    return [...BRAND_ATTRIBUTE_KEYS];
}

export function getCatalogConcepts() {
    return [...CONCEPTS];
}
