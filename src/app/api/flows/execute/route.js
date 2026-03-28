import { supabase } from "@/lib/supabase";

export const maxDuration = 60; // allow long-running flows

// ── Topological sort ──────────────────────────────────────────────────────────
function topoSort(nodes, edges) {
    const inDegree = {};
    const adj = {};
    nodes.forEach((n) => { inDegree[n.id] = 0; adj[n.id] = []; });
    edges.forEach((e) => {
        if (adj[e.source]) adj[e.source].push({ to: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle });
        if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    });

    const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    const result = [];
    while (queue.length > 0) {
        const id = queue.shift();
        result.push(id);
        (adj[id] || []).forEach(({ to }) => {
            inDegree[to]--;
            if (inDegree[to] === 0) queue.push(to);
        });
    }
    return result;
}

// ── Template interpolation  {{varName}} ───────────────────────────────────────
function interpolate(template, data) {
    if (!template) return template;
    const dataStr = typeof data === "string" ? data : JSON.stringify(data);
    return template
        .replace(/\{\{input\}\}/g, dataStr)
        .replace(/\{\{input\.(\w+)\}\}/g, (_, key) => {
            const obj = typeof data === "object" ? data : {};
            return obj[key] !== undefined ? String(obj[key]) : "";
        });
}

// ── Node executors ────────────────────────────────────────────────────────────

async function execTriggerPhoto(node, context) {
    if (context.photoBase64) return { photo: context.photoBase64, mimeType: context.photoMime || "image/jpeg" };
    return { photo: null, message: "No photo provided — using test mode" };
}

async function execTriggerWebhook(node, context) {
    return context.webhookData || { message: "Webhook triggered" };
}

async function execGeminiVision(node, context, input) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY не задан в .env.local");

    const photo = input?.photo;
    if (!photo) throw new Error("Нет фото на входе. Подключите узел 'Загрузка фото'");

    const prompt = node.data.config?.prompt || "Опиши этот товар детально в формате JSON.";
    const language = node.data.config?.language || "ru";
    const fullPrompt = `${prompt}\n\nОтвечай на ${language === "ru" ? "русском" : "English"} языке. Верни чистый JSON без markdown.`;

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const imageData = photo.startsWith("data:") ? photo.split(",")[1] : photo;
    const mimeType = input?.mimeType || "image/jpeg";

    const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ parts: [{ text: fullPrompt }, { inlineData: { mimeType, data: imageData } }] }],
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Try parse JSON
    try {
        const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(clean);
    } catch {
        return { raw: text };
    }
}

async function execGroqLlama(node, context, input) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY не задан в .env.local");

    const model = node.data.config?.model || "llama3-8b-8192";
    const systemPrompt = node.data.config?.system_prompt || "Ты — полезный ИИ-ассистент.";
    const userTemplate = node.data.config?.user_template || "{{input}}";
    const temperature = parseFloat(node.data.config?.temperature || "0.7");

    const userMessage = interpolate(userTemplate, input);

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
            temperature,
            max_tokens: 1500,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq API error: ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
}

async function execIfElse(node, context, input) {
    const field = node.data.config?.field || "";
    const operator = node.data.config?.operator || "contains";
    const value = node.data.config?.value || "";

    const obj = typeof input === "object" && input !== null ? input : {};
    const fieldVal = obj[field] !== undefined ? String(obj[field]) : String(input || "");
    const checkVal = String(value).toLowerCase();
    const testVal = fieldVal.toLowerCase();

    let result = false;
    if (operator === "contains") result = testVal.includes(checkVal);
    else if (operator === "equals") result = testVal === checkVal;
    else if (operator === "not_equals") result = testVal !== checkVal;
    else if (operator === "starts_with") result = testVal.startsWith(checkVal);

    return { __branch: result ? "true" : "false", data: input };
}

async function execRouter(node, context, input) {
    const field = node.data.config?.field || "";
    const r1 = (node.data.config?.route_1_value || "").toLowerCase();
    const r2 = (node.data.config?.route_2_value || "").toLowerCase();

    const obj = typeof input === "object" && input !== null ? input : {};
    const fieldVal = String(obj[field] !== undefined ? obj[field] : input || "").toLowerCase();

    let route = "route_3";
    if (r1 && fieldVal.includes(r1)) route = "route_1";
    else if (r2 && fieldVal.includes(r2)) route = "route_2";

    return { __branch: route, data: input };
}

async function execSupabaseInsert(node, context, input) {
    const table = node.data.config?.table;
    if (!table) throw new Error("Не указана таблица Supabase");

    let row = {};
    const mappingStr = node.data.config?.mapping;
    if (mappingStr) {
        try {
            const tpl = interpolate(mappingStr, input);
            row = JSON.parse(tpl);
        } catch {
            row = typeof input === "object" ? input : { data: input };
        }
    } else {
        row = typeof input === "object" ? input : { data: input };
    }

    const { data, error } = await supabase.from(table).insert([row]).select().single();
    if (error) throw new Error(`Supabase insert error: ${error.message}`);
    return data;
}

async function execJsonParser(node, context, input) {
    let obj = input;
    if (typeof input === "string") {
        try {
            const clean = input.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            obj = JSON.parse(clean);
        } catch {
            obj = { raw: input };
        }
    }

    const extractField = node.data.config?.extract_field;
    if (extractField && typeof obj === "object") {
        // Simple dot-notation extraction: "data.items.0"
        const keys = extractField.replace(/\[(\d+)\]/g, ".$1").split(".");
        let val = obj;
        for (const k of keys) {
            if (val && typeof val === "object") val = val[k];
            else { val = undefined; break; }
        }
        return val !== undefined ? val : obj;
    }
    return obj;
}

async function execTelegram(node, context, input) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан. Добавьте в Настройки → Интеграции.");

    const chatId = node.data.config?.chat_id;
    if (!chatId) throw new Error("Не указан Chat ID");

    const template = node.data.config?.template || "{{input}}";
    const text = interpolate(template, input);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Telegram API error: ${err}`);
    }

    return { sent: true, chat_id: chatId };
}

// ── Node type → executor map ──────────────────────────────────────────────────
const EXECUTORS = {
    trigger_photo: execTriggerPhoto,
    trigger_webhook: execTriggerWebhook,
    ai_gemini_vision: execGeminiVision,
    ai_groq_llama: execGroqLlama,
    logic_ifelse: execIfElse,
    logic_router: execRouter,
    data_supabase: execSupabaseInsert,
    data_json_parser: execJsonParser,
    data_telegram: execTelegram,
};

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
    try {
        const formData = await request.formData();
        const flowJson = formData.get("flow");
        const photoFile = formData.get("photo");

        if (!flowJson) return Response.json({ error: "flow JSON is required" }, { status: 400 });

        const { nodes, edges } = JSON.parse(flowJson);
        if (!nodes || nodes.length === 0) return Response.json({ error: "No nodes in flow" }, { status: 400 });

        // Build context
        const context = { webhookData: null };
        if (photoFile) {
            const buf = await photoFile.arrayBuffer();
            context.photoBase64 = Buffer.from(buf).toString("base64");
            context.photoMime = photoFile.type || "image/jpeg";
        }

        // Topological sort
        const sortedIds = topoSort(nodes, edges);
        const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

        // Build edge map: for each node, which output handle connects to which node+handle
        const edgeMap = {}; // sourceId+handle -> [{targetId, targetHandle}]
        edges.forEach((e) => {
            const key = `${e.source}::${e.sourceHandle || "output"}`;
            if (!edgeMap[key]) edgeMap[key] = [];
            edgeMap[key].push({ targetId: e.target, targetHandle: e.targetHandle || "input" });
        });

        // Input accumulator per node
        const nodeInputs = {}; // nodeId -> accumulated input value

        const steps = [];
        let hasError = false;

        for (const nodeId of sortedIds) {
            const node = nodeMap[nodeId];
            if (!node) continue;

            const nodeType = node.data?.nodeType;
            const executor = EXECUTORS[nodeType];
            const input = nodeInputs[nodeId];
            const label = node.data?.label || nodeType;

            if (!executor) {
                steps.push({ nodeId, label, success: false, error: `Неизвестный тип узла: ${nodeType}` });
                hasError = true;
                continue;
            }

            let output;
            let success = true;
            let stepError = null;

            try {
                output = await executor(node, context, input);
            } catch (e) {
                success = false;
                stepError = e.message;
                hasError = true;
                steps.push({ nodeId, label, success: false, error: stepError });
                continue;
            }

            steps.push({ nodeId, label, success: true, output });

            // Propagate output to downstream nodes
            // Handle branch logic (IF/ELSE, Router)
            if (output && typeof output === "object" && output.__branch) {
                const branchKey = `${nodeId}::${output.__branch}`;
                const targets = edgeMap[branchKey] || [];
                targets.forEach(({ targetId }) => {
                    nodeInputs[targetId] = output.data;
                });
            } else {
                // Try common output handle names, then fall back to all outgoing edges
                const nodeType = node.data?.nodeType;
                const def = { trigger_photo: ["photo"], trigger_webhook: ["data"], ai_gemini_vision: ["json"], ai_groq_llama: ["text"], data_supabase: ["result"], data_json_parser: ["json"] };
                const handles = def[nodeType] || ["output", "text", "json", "data", "result"];

                let propagated = false;
                for (const h of handles) {
                    const key = `${nodeId}::${h}`;
                    if (edgeMap[key]) {
                        edgeMap[key].forEach(({ targetId }) => { nodeInputs[targetId] = output; });
                        propagated = true;
                    }
                }
                // Also try all edges from this source
                if (!propagated) {
                    Object.keys(edgeMap).filter((k) => k.startsWith(nodeId + "::")).forEach((k) => {
                        edgeMap[k].forEach(({ targetId }) => { nodeInputs[targetId] = output; });
                    });
                }
            }
        }

        return Response.json({ success: !hasError, steps });
    } catch (e) {
        return Response.json({ success: false, error: e.message, steps: [] }, { status: 500 });
    }
}
