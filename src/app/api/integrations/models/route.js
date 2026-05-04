import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { AI_MODELS } from '@/config/models';
import { getAllowedModelIds, normalizeModels } from '@/lib/integration-docs';
import { getEnabledTextModels } from '@/lib/model-settings';

export const runtime = 'nodejs';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

function getBearerToken(req) {
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return '';
    return authHeader.split(' ')[1] || '';
}

export async function GET(req) {
    try {
        const apiKey = getBearerToken(req);
        if (!apiKey) {
            return NextResponse.json({ error: 'Неавторизован. Требуется Bearer токен.' }, { status: 401, headers: corsHeaders });
        }

        const { data: integrationsData, error: integrationsError } = await supabase
            .from('ai_settings')
            .select('*')
            .eq('id', 'integrations')
            .single();

        if (integrationsError && integrationsError.code !== 'PGRST116') {
            return NextResponse.json({ error: integrationsError.message }, { status: 500, headers: corsHeaders });
        }

        const integrations = integrationsData?.data?.integrations || [];
        const integration = integrations.find(item => item.apiKey === apiKey);

        if (!integration) {
            return NextResponse.json({ error: 'Неверный API ключ интеграции.' }, { status: 401, headers: corsHeaders });
        }

        const { data: settingsData } = await supabase
            .from('ai_settings')
            .select('data')
            .eq('id', 'global')
            .single();

        const textModels = normalizeModels(getEnabledTextModels(settingsData?.data, AI_MODELS.text));
        const modelById = new Map(textModels.map(model => [model.id, model]));
        const tasks = Array.isArray(integration.tasks) ? integration.tasks : [];

        return NextResponse.json({
            status: 'ok',
            integration: {
                id: integration.id,
                name: integration.name || 'Без названия',
            },
            tasks: tasks.map(task => {
                const allowedModelIds = getAllowedModelIds(task, textModels);
                return {
                    id: task.id,
                    name: task.name || task.id,
                    allowedModels: task.allowedModels || [],
                    models: allowedModelIds
                        .map(modelId => modelById.get(modelId))
                        .filter(Boolean),
                };
            }),
            all_text_models: textModels,
            updated_at: new Date().toISOString(),
        }, { headers: corsHeaders });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}
