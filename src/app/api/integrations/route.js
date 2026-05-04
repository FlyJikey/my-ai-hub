import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req) {
    try {
        const { data, error } = await supabase
            .from('ai_settings')
            .select('*')
            .eq('id', 'integrations')
            .single();

        if (error && error.code !== 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
        }

        // Return empty array if not exists
        return NextResponse.json({ integrations: data?.data?.integrations || [] }, { headers: corsHeaders });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        
        const { error } = await supabase
            .from('ai_settings')
            .upsert({ id: 'integrations', data: { integrations: body.integrations } }, { onConflict: 'id' });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
        }

        return NextResponse.json({ success: true, integrations: body.integrations }, { headers: corsHeaders });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}
