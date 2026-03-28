import { supabase } from "@/lib/supabase";

const INTEGRATIONS_ID = "integrations";

// Fields that should be masked (partially hidden) in GET responses
const SECRET_FIELDS = ["telegram_token", "huggingface_api_key", "supabase_key", "extra_db_password"];

function maskSecret(value) {
    if (!value || value.length < 8) return value;
    return value.slice(0, 6) + "•".repeat(Math.min(value.length - 8, 20)) + value.slice(-4);
}

export async function GET() {
    try {
        const { data, error } = await supabase
            .from("ai_settings")
            .select("data")
            .eq("id", INTEGRATIONS_ID)
            .single();

        if (error) {
            // Not found yet — return empty defaults
            if (error.code === "PGRST116") {
                return Response.json({
                    telegram_token: "", huggingface_api_key: "",
                    supabase_url: "", supabase_key: "",
                    extra_db_url: "", extra_db_user: "", extra_db_password: "",
                });
            }
            return Response.json({ error: error.message }, { status: 500 });
        }

        const raw = data?.data || {};
        // Return masked secrets so they're visible but not easily copyable
        const masked = { ...raw };
        SECRET_FIELDS.forEach((f) => {
            if (masked[f]) masked[f] = maskSecret(masked[f]);
        });

        return Response.json(masked);
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();

        // Don't overwrite real secrets if client sends back masked values (•••)
        // First load existing data
        const { data: existing } = await supabase
            .from("ai_settings")
            .select("data")
            .eq("id", INTEGRATIONS_ID)
            .single();

        const existingData = existing?.data || {};
        const merged = { ...existingData };

        // Only update fields that don't look like masked values
        Object.entries(body).forEach(([k, v]) => {
            if (typeof v === "string" && v.includes("•")) {
                // Masked — keep existing
            } else {
                merged[k] = v;
            }
        });

        const { error } = await supabase
            .from("ai_settings")
            .upsert({ id: INTEGRATIONS_ID, data: merged }, { onConflict: "id" });

        if (error) return Response.json({ error: error.message }, { status: 500 });

        return Response.json({ success: true });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}

// Helper used by flow executor to get real (unmasked) integration values
export async function getIntegrationValue(key) {
    try {
        const { data } = await supabase
            .from("ai_settings")
            .select("data")
            .eq("id", INTEGRATIONS_ID)
            .single();
        return data?.data?.[key] || null;
    } catch {
        return null;
    }
}
