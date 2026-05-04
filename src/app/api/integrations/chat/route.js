import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: "Неавторизован. Требуется Bearer токен." }, { status: 401, headers: corsHeaders });
        }
        const apiKey = authHeader.split(' ')[1];

        const { data: integrationsData } = await supabase
            .from('ai_settings')
            .select('*')
            .eq('id', 'integrations')
            .single();

        const integrations = integrationsData?.data?.integrations || [];
        const integration = integrations.find(i => i.apiKey === apiKey);

        if (!integration) {
            return NextResponse.json({ error: "Неверный API ключ интеграции." }, { status: 401, headers: corsHeaders });
        }

        const body = await req.json();
        const { prompt, task, model } = body;

        if (!prompt || !task) {
            return NextResponse.json({ error: "Необходимы параметры prompt и task" }, { status: 400, headers: corsHeaders });
        }

        // Find the task configuration
        const taskConfig = integration.tasks?.find(t => t.id === task);
        if (!taskConfig) {
            return NextResponse.json({ error: `Задача '${task}' не настроена для этой интеграции.` }, { status: 403, headers: corsHeaders });
        }

        // Determine which model to use
        let selectedModel = model;
        if (!selectedModel) {
            // Fallback to the first available model for this task
            if (taskConfig.allowedModels && taskConfig.allowedModels.length > 0) {
                selectedModel = taskConfig.allowedModels[0];
            } else {
                return NextResponse.json({ error: "Не указана модель и нет разрешенных моделей по умолчанию." }, { status: 400, headers: corsHeaders });
            }
        }

        // Validate model allowed
        if (taskConfig.allowedModels && taskConfig.allowedModels.length > 0 && taskConfig.allowedModels[0] !== 'all') {
            if (!taskConfig.allowedModels.includes(selectedModel)) {
                return NextResponse.json({ error: `Модель '${selectedModel}' не разрешена для задачи '${task}'. Разрешены: ${taskConfig.allowedModels.join(', ')}` }, { status: 403, headers: corsHeaders });
            }
        }

        // We prepare messages
        const messages = [
            { role: "user", content: prompt }
        ];

        // Build base URL — origin header is absent for server-to-server requests,
        // so fall back to host header (always present on Vercel) or env var.
        const origin = req.headers.get('origin');
        const host = req.headers.get('host');
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

        let baseUrl;
        if (origin) {
            baseUrl = origin.endsWith('/') ? origin.slice(0, -1) : origin;
        } else if (siteUrl) {
            baseUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
        } else if (host) {
            const protocol = host.includes('localhost') ? 'http' : 'https';
            baseUrl = `${protocol}://${host}`;
        } else {
            baseUrl = 'http://localhost:3000';
        }

        const chatReq = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                messages: messages,
                temperature: 0.1,
                max_tokens: 2000
            })
        });

        const chatRes = await chatReq.json();

        if (!chatReq.ok) {
            return NextResponse.json({ error: chatRes.error || "Ошибка внутреннего API чата" }, { status: chatReq.status, headers: corsHeaders });
        }

        // Return a simplified response format for integrations
        return NextResponse.json({
            status: "ok",
            answer: chatRes.choices?.[0]?.message?.content || chatRes.answer || "Нет ответа",
            model_used: selectedModel
        }, { headers: corsHeaders });

    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}
