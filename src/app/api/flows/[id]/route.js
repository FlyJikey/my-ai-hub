import { supabase } from "@/lib/supabase";

export async function GET(request, { params }) {
    const { id } = await params;
    const { data, error } = await supabase.from("flows").select("*").eq("id", id).single();
    if (error) return Response.json({ error: error.message }, { status: 404 });
    return Response.json(data);
}

export async function PUT(request, { params }) {
    const { id } = await params;
    const body = await request.json();
    const { name, nodes, edges } = body;

    const { data, error } = await supabase
        .from("flows")
        .update({ name, nodes: nodes || [], edges: edges || [], updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data);
}

export async function DELETE(request, { params }) {
    const { id } = await params;
    const { error } = await supabase.from("flows").delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
}
