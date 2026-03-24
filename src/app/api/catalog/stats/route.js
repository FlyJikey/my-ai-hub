import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
    try {
        // 1. Total count
        const { count: total, error: countError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        // 1.5. Vectorized count
        const { count: vectorized, error: vectorizedError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .not('embedding', 'is', null);

        if (vectorizedError) throw vectorizedError;

        // 2. Categories count (optimized: count distinct in SQL)
        let categories = 0;
        const { data: catData, error: catError } = await supabase
            .rpc('count_distinct_categories');
            
        if (!catError && catData !== null) {
            categories = catData;
        } else if (catError) {
            // Fallback to old method if RPC doesn't exist
            console.warn('RPC count_distinct_categories not found, using fallback');
            const { data: allCats } = await supabase
                .from('products')
                .select('category');
            if (allCats) {
                const uniqueCategories = new Set(allCats.map(item => item.category).filter(Boolean));
                categories = uniqueCategories.size;
            }
        }

        // 3. Last updated
        const { data: lastItem } = await supabase
            .from('products')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const lastUpdated = lastItem?.created_at || null;
        const hasData = (total && total > 0) ? true : false;

        return NextResponse.json({
            total: total || 0,
            vectorized: vectorized || 0,
            categories,
            lastUpdated,
            hasData
        }, { headers: corsHeaders });

    } catch (error) {
        console.error("Stats error:", error);
        return NextResponse.json({ error: "Внутренняя ошибка: " + error.message }, { status: 500, headers: corsHeaders });
    }
}
