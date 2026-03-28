import { stripCatalogNoise } from "@/lib/catalog-synonyms";

const TOTAL_COUNT_PATTERNS = [
    /сколько\s+(?:товаров|позиций)(?:\s+у\s+нас)?(?:\s+в\s+базе)?/i,
    /общее\s+количество\s+(?:товаров|позиций)/i,
    /сколько\s+у\s+нас\s+товаров/i
];

const OVERVIEW_PATTERNS = [
    /что\s+есть\s+в\s+базе/i,
    /что\s+у\s+нас\s+в\s+базе/i,
    /какой\s+ассортимент/i,
    /что\s+есть\s+в\s+каталоге/i
];

const BRAND_PATTERNS = [
    /все\s+бренды/i,
    /какие\s+бренды/i,
    /какие\s+марки/i,
    /список\s+брендов/i,
    /бренды/i,
    /марки/i
];

const COUNT_PATTERNS = [/сколько/i, /количество/i];
const EXISTS_PATTERNS = [/есть\s+ли/i, /имеются\s+ли/i, /найдутся\s+ли/i];
const LIST_PATTERNS = [/покажи/i, /выведи/i, /что\s+есть/i, /какие\s+есть/i, /найди/i, /подбери/i];

function isGenericSubject(value) {
    const normalized = stripCatalogNoise(value).toLowerCase();
    return ["", "товар", "товары", "бренд", "бренды", "марка", "марки"].includes(normalized);
}

function extractSubjectWithPatterns(message) {
    const patterns = [
        /(?:какие\s+бренды|какие\s+марки|все\s+бренды|список\s+брендов)\s+(?:у|для|по|среди)\s+(.+)/i,
        /(?:сколько|количество)\s+(.+)/i,
        /(?:есть\s+ли|имеются\s+ли|найдутся\s+ли)\s+(.+)/i,
        /(?:покажи|выведи|найди|подбери)\s+(.+)/i,
        /(?:что\s+есть|какие\s+есть)\s+(?:у|для|по)?\s*(.+)/i
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match?.[1]) {
            return cleanupSubject(match[1]);
        }
    }

    return "";
}

function cleanupSubject(value) {
    return stripCatalogNoise(
        String(value || "")
            .replace(/(^|\s)(все|всех|мне|пожалуйста|можешь|можно|скажи|покажи|выведи|найди)(?=\s|$)/gi, " ")
            .replace(/(^|\s)(бренды|бренд|марки|марка)(?=\s|$)/gi, " ")
            .replace(/(^|\s)(у нас|в базе|в каталоге|по базе|из базы)(?=\s|$)/gi, " ")
    );
}

function getHistorySubject(history = []) {
    const userMessages = history
        .filter((message) => message?.role === "user")
        .map((message) => String(message?.text || message?.content || "").trim())
        .filter(Boolean)
        .reverse();

    for (const message of userMessages) {
        const subject = extractSubjectWithPatterns(message);
        if (!isGenericSubject(subject)) {
            return subject;
        }
    }

    return "";
}

function matchesAnyPattern(value, patterns) {
    return patterns.some((pattern) => pattern.test(value));
}

export function detectCatalogIntent(message, history = []) {
    const sourceMessage = String(message || "").trim();
    const cleanedMessage = cleanupSubject(sourceMessage);
    let subject = extractSubjectWithPatterns(sourceMessage);

    if (isGenericSubject(subject)) {
        const historySubject = getHistorySubject(history);
        if (historySubject) {
            subject = historySubject;
        }
    }

    if (matchesAnyPattern(sourceMessage, TOTAL_COUNT_PATTERNS) && isGenericSubject(subject)) {
        return {
            intent: "total_count",
            subject: "",
            cleanedMessage
        };
    }

    if (matchesAnyPattern(sourceMessage, OVERVIEW_PATTERNS)) {
        return {
            intent: "overview",
            subject: "",
            cleanedMessage
        };
    }

    if (matchesAnyPattern(sourceMessage, BRAND_PATTERNS)) {
        return {
            intent: "brands",
            subject: isGenericSubject(subject) ? "" : subject,
            cleanedMessage
        };
    }

    if (matchesAnyPattern(sourceMessage, EXISTS_PATTERNS)) {
        return {
            intent: "exists",
            subject: isGenericSubject(subject) ? cleanedMessage : subject,
            cleanedMessage
        };
    }

    if (matchesAnyPattern(sourceMessage, COUNT_PATTERNS)) {
        return {
            intent: "count",
            subject: isGenericSubject(subject) ? cleanedMessage : subject,
            cleanedMessage
        };
    }

    if (matchesAnyPattern(sourceMessage, LIST_PATTERNS)) {
        if (isGenericSubject(subject) && isGenericSubject(cleanedMessage)) {
            return {
                intent: "overview",
                subject: "",
                cleanedMessage
            };
        }

        return {
            intent: "list",
            subject: isGenericSubject(subject) ? cleanedMessage : subject,
            cleanedMessage
        };
    }

    if (isGenericSubject(subject) && isGenericSubject(cleanedMessage)) {
        return {
            intent: "overview",
            subject: "",
            cleanedMessage
        };
    }

    return {
        intent: "search",
        subject: isGenericSubject(subject) ? cleanedMessage : subject,
        cleanedMessage
    };
}
