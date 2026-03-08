import { supabase } from '@/lib/supabase';

export async function logApiError(type, provider, model, errorMsg, details) {
    try {
        // We do not want to block the main response, so we just run this
        const newLog = {
            id: Date.now().toString() + Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            type, // 'vision' | 'text' | 'system'
            provider: provider || 'unknown',
            model: model || 'unknown',
            message: errorMsg,
            details: details || {}
        };

        // Fetch current logs
        const { data: currentData } = await supabase
            .from('ai_settings')
            .select('data')
            .eq('id', 'logs')
            .single();

        let logs = [];
        if (currentData && currentData.data && Array.isArray(currentData.data)) {
            logs = currentData.data;
        }

        // Prepend new log and keep up to 100
        logs = [newLog, ...logs].slice(0, 100);

        // Upsert back
        await supabase
            .from('ai_settings')
            .upsert({ id: 'logs', data: logs }, { onConflict: 'id' });

    } catch (e) {
        console.error("Failed to save error log to Supabase:", e);
    }
}
