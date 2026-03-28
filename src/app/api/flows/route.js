import { supabase } from "@/lib/supabase";

// Ensure the flows table exists (idempotent)
async function ensureTable() {
    await supabase.rpc("create_flows_table_if_not_exists").catch(() => {});
    // Fallback: try direct create
    await supabase.from("flows").select("id").limit(1).catch(() => {});
}

export async function GET() {
    try {
        const { data, error } = await supabase
            .from("flows")
            .select("id, name, created_at, updated_at")
            .order("updated_at", { ascending: false });

        if (error) {
            // Table may not exist yet — return empty list gracefully
            if (error.code === "42P01") return Response.json({ flows: [] });
            return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ flows: data || [] });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { name, nodes, edges } = body;

        if (!name) return Response.json({ error: "name is required" }, { status: 400 });

        const { data, error } = await supabase
            .from("flows")
            .insert([{ name, nodes: nodes || [], edges: edges || [], updated_at: new Date().toISOString() }])
            .select()
            .single();

        if (error) {
            // Table doesn't exist — try to create it first
            if (error.code === "42P01") {
                const createErr = await createFlowsTable();
                if (createErr) return Response.json({ error: "Таблица flows не создана. Запустите миграцию." }, { status: 500 });
                // Retry
                const { data: d2, error: e2 } = await supabase
                    .from("flows")
                    .insert([{ name, nodes: nodes || [], edges: edges || [], updated_at: new Date().toISOString() }])
                    .select()
                    .single();
                if (e2) return Response.json({ error: e2.message }, { status: 500 });
                return Response.json(d2, { status: 201 });
            }
            return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json(data, { status: 201 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}

async function createFlowsTable() {
    const { error } = await supabase.rpc("exec_sql", {
        sql: `CREATE TABLE IF NOT EXISTS flows (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            name text NOT NULL,
            nodes jsonb DEFAULT '[]'::jsonb,
            edges jsonb DEFAULT '[]'::jsonb,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );`
    });
    return error;
}
