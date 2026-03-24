import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('ai_settings')
            .select('data')
            .eq('id', 'logs')
            .single();

        if (error && error.code !== 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
        }

        const logs = data?.data || [];
        return NextResponse.json({ logs }, { headers: corsHeaders });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}

export async function DELETE(req) {
    // Проверка авторизации для удаления логов
    const authResult = requireAuth(req);
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: 401, headers: corsHeaders });
    }

    try {
        const { error } = await supabase
            .from('ai_settings')
            .upsert({ id: 'logs', data: [] }, { onConflict: 'id' });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
        }

        return NextResponse.json({ success: true }, { headers: corsHeaders });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}
