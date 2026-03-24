import { supabase } from "@/lib/supabase";

export const DEFAULT_CATALOG_EMBEDDING = {
    model: "text-embedding-3-small",
    provider: "polza"
};

const SETTINGS_ROW_ID = "global";

function isMissingSettingsError(error) {
    if (!error) {
        return false;
    }

    return ["PGRST116", "42P01"].includes(error.code);
}

export async function getGlobalAiSettingsData() {
    try {
        const { data, error } = await supabase
            .from("ai_settings")
            .select("data")
            .eq("id", SETTINGS_ROW_ID)
            .single();

        if (error) {
            if (!isMissingSettingsError(error)) {
                console.warn("[CATALOG SETTINGS] Failed to read ai_settings:", error.message || error);
            }
            return {};
        }

        return data?.data && typeof data.data === "object" ? data.data : {};
    } catch (error) {
        console.warn("[CATALOG SETTINGS] Unexpected read error:", error.message || error);
        return {};
    }
}

export async function mergeGlobalAiSettingsData(patch) {
    const current = await getGlobalAiSettingsData();
    const next = {
        ...current,
        ...patch
    };

    try {
        const { data: existingRow, error: readError } = await supabase
            .from("ai_settings")
            .select("id")
            .eq("id", SETTINGS_ROW_ID)
            .single();

        if (readError && !isMissingSettingsError(readError)) {
            console.warn("[CATALOG SETTINGS] Failed to check ai_settings row:", readError.message || readError);
            return current;
        }

        if (!existingRow) {
            console.warn("[CATALOG SETTINGS] Skipped ai_settings update because the global settings row does not exist yet");
            return current;
        }

        const { error } = await supabase
            .from("ai_settings")
            .update({ data: next })
            .eq("id", SETTINGS_ROW_ID);

        if (error) {
            console.warn("[CATALOG SETTINGS] Failed to update ai_settings:", error.message || error);
            return current;
        }

        return next;
    } catch (error) {
        console.warn("[CATALOG SETTINGS] Unexpected update error:", error.message || error);
        return current;
    }
}

export async function getCatalogEmbeddingConfig() {
    const settings = await getGlobalAiSettingsData();
    const config = settings.catalogEmbedding;

    if (config && typeof config === "object" && config.model && config.provider) {
        return {
            model: config.model,
            provider: config.provider
        };
    }

    return { ...DEFAULT_CATALOG_EMBEDDING };
}

export async function setCatalogEmbeddingConfig({ model, provider }) {
    if (!model || !provider) {
        return null;
    }

    const next = await mergeGlobalAiSettingsData({
        catalogEmbedding: { model, provider }
    });

    return next.catalogEmbedding || null;
}

export async function clearCatalogEmbeddingConfig() {
    await mergeGlobalAiSettingsData({ catalogEmbedding: null });
}
