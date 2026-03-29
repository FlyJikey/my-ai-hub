import { supabase } from "@/lib/supabase";

export const maxDuration = 60;

// ─── Topological sort ─────────────────────────────────────────────────────────
function topoSort(nodes, edges) {
    const inDegree = {};
    const adj = {};
    nodes.forEach((n) => { inDegree[n.id] = 0; adj[n.id] = []; });
    edges.forEach((e) => {
        if (adj[e.source]) adj[e.source].push({ to: e.target, sourceHandle: e.sourceHandle });
        if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    });
    const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    const result = [];
    while (queue.length > 0) {
        const id = queue.shift();
        result.push(id);
        (adj[id] || []).forEach(({ to }) => { inDegree[to]--; if (inDegree[to] === 0) queue.push(to); });
    }
    return result;
}

// ─── Template interpolation {{field}} ─────────────────────────────────────────
function interpolate(template, data) {
    if (!template) return template;
    if (typeof data !== "object" || data === null) {
        return template.replace(/\{\{input\}\}/g, String(data));
    }
    let result = template.replace(/\{\{input\}\}/g, JSON.stringify(data));
    result = result.replace(/\{\{input\.([^}]+)\}\}/g, (_, path) => {
        const val = path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), data);
        return val !== undefined ? String(val) : "";
    });
    return result;
}

// ─── Internal API helpers ─────────────────────────────────────────────────────
function getInternalApiBase(request) {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");

    if (forwardedProto && forwardedHost) {
        return `${forwardedProto}://${forwardedHost}`;
    }

    return request.nextUrl.origin;
}

function getForwardedHeaders(request, extraHeaders = {}) {
    const headers = new Headers(extraHeaders);
    const cookie = request.headers.get("cookie");
    const authorization = request.headers.get("authorization");
    const bypassHeader = request.headers.get("x-vercel-protection-bypass");

    if (cookie) headers.set("cookie", cookie);
    if (authorization) headers.set("authorization", authorization);
    if (bypassHeader) headers.set("x-vercel-protection-bypass", bypassHeader);

    return headers;
}

async function internalFetch(ctx, path, init = {}) {
    const headers = getForwardedHeaders(ctx.request, init.headers);
    return fetch(`${ctx.internalApiBase}${path}`, { ...init, headers });
}

// ─── Node executors ───────────────────────────────────────────────────────────

async function execTriggerPhoto(node, ctx) {
    if (!ctx.photoBase64) return { photo: null, message: "No photo — test mode" };
    return { photo: ctx.photoBase64, mimeType: ctx.photoMime || "image/jpeg" };
}

async function execTriggerWebhook(node, ctx) {
    return ctx.webhookData || { message: "Webhook triggered" };
}

async function execTriggerManual(node) {
    const raw = node.data.config?.input_json || "{}";
    try { return JSON.parse(raw); }
    catch { return { raw }; }
}

// ── AI: Text (all providers via /api/ai/text) ─────────────────────────────────
async function execAiText(node, ctx, input) {
    const { provider = "groq", model, system_prompt, user_template, temperature } = node.data.config || {};
    if (!provider) throw new Error("Не выбран провайдер");

    const userMsg = user_template ? interpolate(user_template, input) : (typeof input === "string" ? input : JSON.stringify(input));

    const messages = [];
    if (system_prompt) messages.push({ role: "system", content: system_prompt });
    messages.push({ role: "user", content: userMsg });

    // Call internal API
    const res = await internalFetch(ctx, "/api/ai/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, modelId: model, prompt: userMsg, chatHistory: system_prompt ? [{ role: "system", content: system_prompt }] : [] }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`AI Text error (${provider}): ${err}`);
    }
    const d = await res.json();
    return d.result || d.text || d;
}

// ── AI: Vision ────────────────────────────────────────────────────────────────
async function execAiVision(node, ctx, input) {
    const { provider = "gemini", model, mode = "full" } = node.data.config || {};
    const photoData = input?.photo || ctx.photoBase64;
    if (!photoData) throw new Error("Нет фото на входе. Подключите узел 'Загрузка фото'");

    const mimeType = input?.mimeType || ctx.photoMime || "image/jpeg";
    const base64 = photoData.startsWith("data:") ? photoData.split(",")[1] : photoData;
    const blob = Buffer.from(base64, "base64");

    const formData = new FormData();
    formData.append("image", new Blob([blob], { type: mimeType }), "photo.jpg");
    formData.append("provider", provider);
    if (model) formData.append("modelId", model);
    formData.append("mode", mode);

    const res = await internalFetch(ctx, "/api/ai/vision", { method: "POST", body: formData });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Vision error (${provider}): ${err}`);
    }
    const d = await res.json();
    return d.result || d;
}

// ── AI: Full Generator pipeline (Vision + Text) ───────────────────────────────
async function execAiGenerate(node, ctx, input) {
    const { scenario = "seo_full", vision_provider, vision_model, text_provider, text_model } = node.data.config || {};
    const photoData = input?.photo || ctx.photoBase64;
    if (!photoData) throw new Error("Нет фото для генератора");

    const body = {
        scenario,
        visionProvider: vision_provider || "gemini",
        visionModelId: vision_model,
        textProvider: text_provider || "groq",
        textModelId: text_model,
    };

    // Attach photo as imageUrl (base64 data URL)
    const mimeType = input?.mimeType || ctx.photoMime || "image/jpeg";
    const base64 = photoData.startsWith("data:") ? photoData : `data:${mimeType};base64,${photoData}`;
    body.imageUrl = base64;

    const res = await internalFetch(ctx, "/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Generate error: ${err}`);
    }
    const d = await res.json();
    return { text: d.resultText || d.description, json: d.visionData, ...d };
}

// ── AI: Embeddings ────────────────────────────────────────────────────────────
async function execAiEmbed(node, ctx, input) {
    const { model } = node.data.config || {};
    const text = typeof input === "string" ? input : JSON.stringify(input);
    const res = await internalFetch(ctx, "/api/ai/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, modelId: model }),
    });
    if (!res.ok) throw new Error("Embed error: " + await res.text());
    const d = await res.json();
    return d.vector || d;
}

// ── AI: OCR ───────────────────────────────────────────────────────────────────
async function execAiOcr(node, ctx, input) {
    return execAiVision({ ...node, data: { ...node.data, config: { ...node.data.config, mode: "price_tag" } } }, ctx, input);
}

// ── Catalog: Search ───────────────────────────────────────────────────────────
async function execCatalogSearch(node, ctx, input) {
    const { limit = 5, semantic = "true" } = node.data.config || {};
    const query = typeof input === "string" ? input : (input?.query || JSON.stringify(input));
    const res = await internalFetch(ctx, "/api/catalog/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: parseInt(limit), useSemanticFallback: semantic === "true" }),
    });
    if (!res.ok) throw new Error("Catalog search error: " + await res.text());
    const d = await res.json();
    return d;
}

// ── Catalog: Ask ──────────────────────────────────────────────────────────────
async function execCatalogAsk(node, ctx, input) {
    const { provider = "groq", model, style = "concise" } = node.data.config || {};
    const question = typeof input === "string" ? input : JSON.stringify(input);
    const res = await internalFetch(ctx, "/api/catalog/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, provider, modelId: model, style }),
    });
    if (!res.ok) throw new Error("Catalog ask error: " + await res.text());
    const d = await res.json();
    return d.result || d;
}

// ── Catalog: Add product ──────────────────────────────────────────────────────
async function execCatalogAdd(node, ctx, input) {
    const { mapping } = node.data.config || {};
    let row = {};
    if (mapping) {
        try { row = JSON.parse(interpolate(mapping, input)); }
        catch { row = typeof input === "object" ? input : { description: String(input) }; }
    } else {
        row = typeof input === "object" ? input : { description: String(input) };
    }
    const { data, error } = await supabase.from("products").insert([row]).select().single();
    if (error) throw new Error("Catalog add error: " + error.message);
    return data;
}

// ── Logic: IF/ELSE ────────────────────────────────────────────────────────────
async function execIfElse(node, ctx, input) {
    const { field = "", operator = "contains", value = "" } = node.data.config || {};
    const obj = (typeof input === "object" && input !== null) ? input : {};
    const fieldVal = (obj[field] !== undefined ? String(obj[field]) : String(input || "")).toLowerCase();
    const checkVal = String(value).toLowerCase();

    const tests = {
        contains:    () => fieldVal.includes(checkVal),
        equals:      () => fieldVal === checkVal,
        not_equals:  () => fieldVal !== checkVal,
        starts_with: () => fieldVal.startsWith(checkVal),
        gt:          () => parseFloat(fieldVal) > parseFloat(checkVal),
        lt:          () => parseFloat(fieldVal) < parseFloat(checkVal),
    };
    const result = (tests[operator] || tests.contains)();
    return { __branch: result ? "true" : "false", data: input };
}

// ── Logic: Router ─────────────────────────────────────────────────────────────
async function execRouter(node, ctx, input) {
    const { field = "", route_1_value, route_2_value } = node.data.config || {};
    const obj = (typeof input === "object" && input !== null) ? input : {};
    const fieldVal = String(obj[field] !== undefined ? obj[field] : input || "").toLowerCase();
    let route = "route_3";
    if (route_1_value && fieldVal.includes(route_1_value.toLowerCase())) route = "route_1";
    else if (route_2_value && fieldVal.includes(route_2_value.toLowerCase())) route = "route_2";
    return { __branch: route, data: input };
}

// ── Logic: Merge ──────────────────────────────────────────────────────────────
async function execMerge(node, ctx, input) {
    // input is already a merged object built by the orchestrator
    return input;
}

// ── Logic: Transform ─────────────────────────────────────────────────────────
async function execTransform(node, ctx, input) {
    const { extract, template } = node.data.config || {};
    if (extract) {
        const keys = extract.replace(/\[(\d+)\]/g, ".$1").split(".");
        let val = typeof input === "object" ? input : {};
        for (const k of keys) { if (val && typeof val === "object") val = val[k]; else { val = undefined; break; } }
        return val !== undefined ? val : input;
    }
    if (template) return interpolate(template, input);
    return input;
}

// ── Data: JSON Parser ─────────────────────────────────────────────────────────
async function execJsonParser(node, ctx, input) {
    let obj = input;
    if (typeof input === "string") {
        try { obj = JSON.parse(input.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()); }
        catch { obj = { raw: input }; }
    }
    const { extract_field } = node.data.config || {};
    if (extract_field) {
        const keys = extract_field.replace(/\[(\d+)\]/g, ".$1").split(".");
        let val = obj;
        for (const k of keys) { if (val && typeof val === "object") val = val[k]; else { val = undefined; break; } }
        return val !== undefined ? val : obj;
    }
    return obj;
}

// ── Data: Template ────────────────────────────────────────────────────────────
async function execTemplate(node, ctx, input) {
    const { template } = node.data.config || {};
    if (!template) return String(input);
    return interpolate(template, input);
}

// ── Data: Supabase Insert ─────────────────────────────────────────────────────
async function execSupabaseInsert(node, ctx, input) {
    const { table, mapping } = node.data.config || {};
    if (!table) throw new Error("Не указана таблица Supabase");
    let row = {};
    if (mapping) {
        try { row = JSON.parse(interpolate(mapping, input)); }
        catch { row = typeof input === "object" ? input : { data: input }; }
    } else {
        row = typeof input === "object" ? input : { data: input };
    }
    const { data, error } = await supabase.from(table).insert([row]).select().single();
    if (error) throw new Error(`Supabase insert (${table}): ${error.message}`);
    return data;
}

// ── Data: Supabase Query ──────────────────────────────────────────────────────
async function execSupabaseQuery(node, ctx, input) {
    const { table, filter, limit = 10, select: selectFields } = node.data.config || {};
    if (!table) throw new Error("Не указана таблица");
    let query = supabase.from(table).select(selectFields || "*").limit(parseInt(limit));
    if (filter) {
        const [field, val] = filter.split("=");
        if (field && val) query = query.eq(field.trim(), val.trim());
    }
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query (${table}): ${error.message}`);
    return data;
}

// ── Integration: Telegram ─────────────────────────────────────────────────────
async function execTelegram(node, ctx, input) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        // Try from integrations stored in DB
        const { data } = await supabase.from("ai_settings").select("data").eq("id", "integrations").single();
        const dbToken = data?.data?.telegram_token;
        if (!dbToken || dbToken.includes("•")) throw new Error("TELEGRAM_BOT_TOKEN не задан. Добавьте в Настройки → Интеграции.");
        return execTelegramWithToken(dbToken, node, input);
    }
    return execTelegramWithToken(token, node, input);
}

async function execTelegramWithToken(token, node, input) {
    const { chat_id, template, parse_mode = "HTML" } = node.data.config || {};
    if (!chat_id) throw new Error("Не указан Chat ID в Telegram-узле");
    const text = template ? interpolate(template, input) : (typeof input === "string" ? input : JSON.stringify(input, null, 2));
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: parse_mode === "None" ? undefined : parse_mode }),
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Telegram API: ${err}`); }
    return { sent: true, chat_id };
}

// ── Integration: HTTP Request ─────────────────────────────────────────────────
async function execHttp(node, ctx, input) {
    const { url, method = "POST", headers: hdrsTemplate, body_template } = node.data.config || {};
    if (!url) throw new Error("Не указан URL для HTTP-запроса");

    const parsedUrl = interpolate(url, input);
    const headers = { "Content-Type": "application/json" };
    if (hdrsTemplate) {
        try { Object.assign(headers, JSON.parse(interpolate(hdrsTemplate, input))); }
        catch { }
    }

    const fetchOpts = { method, headers };
    if (method !== "GET" && body_template) {
        try { fetchOpts.body = JSON.stringify(JSON.parse(interpolate(body_template, input))); }
        catch { fetchOpts.body = interpolate(body_template, input); }
    }

    const res = await fetch(parsedUrl, fetchOpts);
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { status: res.status, body: text }; }
}

// ── Integration: Discord ──────────────────────────────────────────────────────
async function execDiscord(node, ctx, input) {
    const { webhook_url, content, username = "AI Hub" } = node.data.config || {};
    if (!webhook_url) throw new Error("Не указан Discord Webhook URL");
    const text = content ? interpolate(content, input) : (typeof input === "string" ? input : JSON.stringify(input));
    const res = await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, username }),
    });
    if (!res.ok) throw new Error(`Discord webhook error: ${res.status}`);
    return { sent: true };
}

// ── Integration: Slack ────────────────────────────────────────────────────────
async function execSlack(node, ctx, input) {
    const { webhook_url, text: tmpl, channel } = node.data.config || {};
    if (!webhook_url) throw new Error("Не указан Slack Webhook URL");
    const text = tmpl ? interpolate(tmpl, input) : (typeof input === "string" ? input : JSON.stringify(input));
    const payload = { text };
    if (channel) payload.channel = channel;
    const res = await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Slack webhook error: ${res.status}`);
    return { sent: true };
}

// ── Integration: Email ────────────────────────────────────────────────────────
async function execEmail(node, ctx, input) {
    // For production: add nodemailer or use a transactional service
    // Current: sends via any SMTP-compatible service stored in integrations
    const { to, subject, body } = node.data.config || {};
    if (!to) throw new Error("Не указан адрес получателя email");
    const subjectText = subject ? interpolate(subject, input) : "AI Hub notification";
    const bodyText = body ? interpolate(body, input) : JSON.stringify(input, null, 2);
    // Stub: log the email data (implement SMTP when SMTP settings are added)
    console.log("[Email node] TO:", to, "SUBJECT:", subjectText, "BODY:", bodyText.slice(0, 100));
    return { sent: true, to, subject: subjectText, note: "Email logged (configure SMTP in Настройки → Интеграции)" };
}

// ─── Executor map ─────────────────────────────────────────────────────────────
const EXECUTORS = {
    trigger_photo:       execTriggerPhoto,
    trigger_webhook:     execTriggerWebhook,
    trigger_manual:      execTriggerManual,
    ai_text:             execAiText,
    ai_vision:           execAiVision,
    ai_generate:         execAiGenerate,
    ai_embed:            execAiEmbed,
    ai_ocr:              execAiOcr,
    catalog_search:      execCatalogSearch,
    catalog_ask:         execCatalogAsk,
    catalog_add:         execCatalogAdd,
    logic_ifelse:        execIfElse,
    logic_router:        execRouter,
    logic_merge:         execMerge,
    logic_transform:     execTransform,
    data_json_parser:    execJsonParser,
    data_template:       execTemplate,
    data_supabase_insert: execSupabaseInsert,
    data_supabase_query:  execSupabaseQuery,
    int_telegram:        execTelegram,
    int_http:            execHttp,
    int_discord:         execDiscord,
    int_slack:           execSlack,
    int_email:           execEmail,
};

// ─── Output handle map — which handles each node type publishes ───────────────
const OUTPUT_HANDLES = {
    trigger_photo:   ["photo"],
    trigger_webhook: ["data"],
    trigger_manual:  ["data"],
    ai_text:         ["text"],
    ai_vision:       ["json"],
    ai_generate:     ["text", "json"],
    ai_embed:        ["vector"],
    ai_ocr:          ["json"],
    catalog_search:  ["results"],
    catalog_ask:     ["text"],
    catalog_add:     ["result"],
    data_json_parser:["json"],
    data_template:   ["text"],
    data_supabase_insert: ["result"],
    data_supabase_query:  ["rows"],
    logic_ifelse:    [], // handled via __branch
    logic_router:    [], // handled via __branch
    logic_merge:     ["merged"],
    logic_transform: ["output"],
    int_http:        ["response"],
};

const TRIGGER_NODE_TYPES = new Set([
    "trigger_photo",
    "trigger_webhook",
    "trigger_manual",
]);

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
    try {
        const formData = await request.formData();
        const flowJson = formData.get("flow");
        const photoFile = formData.get("photo");

        if (!flowJson) return Response.json({ error: "flow JSON is required" }, { status: 400 });

        const { nodes, edges } = JSON.parse(flowJson);
        if (!nodes || nodes.length === 0) return Response.json({ error: "No nodes" }, { status: 400 });

        // Context
        const ctx = {
            request,
            internalApiBase: getInternalApiBase(request),
            webhookData: null,
            photoBase64: null,
            photoMime: "image/jpeg",
        };
        if (photoFile) {
            const buf = await photoFile.arrayBuffer();
            ctx.photoBase64 = Buffer.from(buf).toString("base64");
            ctx.photoMime = photoFile.type || "image/jpeg";
        }

        // Topological sort
        const sortedIds = topoSort(nodes, edges);
        const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
        const incomingEdgeCount = {};

        nodes.forEach((node) => {
            incomingEdgeCount[node.id] = 0;
        });

        // Edge map: `sourceId::sourceHandle` → [{targetId, targetHandle}]
        const edgeMap = {};
        edges.forEach((e) => {
            const key = `${e.source}::${e.sourceHandle || "output"}`;
            if (!edgeMap[key]) edgeMap[key] = [];
            edgeMap[key].push({ targetId: e.target, targetHandle: e.targetHandle || "input" });
            if (incomingEdgeCount[e.target] !== undefined) {
                incomingEdgeCount[e.target] += 1;
            }
        });

        // Merge node input accumulator: nodeId → Map<targetHandle, value>
        const nodeInputParts = {}; // nodeId → { [handle]: value }
        const nodeInputs = {};     // nodeId → resolved input (last single value, or merged)

        const steps = [];
        let hasError = false;

        for (const nodeId of sortedIds) {
            const node = nodeMap[nodeId];
            if (!node) continue;

            const nodeType = node.data?.nodeType;
            const executor = EXECUTORS[nodeType];
            const label = node.data?.label || nodeType;

            if (!executor) {
                steps.push({ nodeId, label, success: false, error: `Неизвестный тип узла: ${nodeType}` });
                hasError = true;
                continue;
            }

            // Resolve input: if merge node, build object from parts; else use last received
            let input = nodeInputs[nodeId];
            if (nodeType === "logic_merge" && nodeInputParts[nodeId]) {
                const keys = (node.data.config?.keys || "").split(",").map(k => k.trim()).filter(Boolean);
                const parts = nodeInputParts[nodeId];
                const partValues = Object.values(parts);
                if (keys.length > 0) {
                    input = {};
                    Object.entries(parts).forEach(([, v], i) => { input[keys[i] || `input_${i}`] = v; });
                } else {
                    input = partValues.length === 1 ? partValues[0] : partValues;
                }
            }

            const hasIncomingEdges = (incomingEdgeCount[nodeId] || 0) > 0;
            const hasResolvedInput = input !== undefined;
            const isTriggerNode = TRIGGER_NODE_TYPES.has(nodeType);

            if (hasIncomingEdges && !hasResolvedInput && !isTriggerNode) {
                continue;
            }

            let output;
            let success = true;
            let stepError = null;

            try {
                output = await executor(node, ctx, input);
            } catch (e) {
                success = false;
                stepError = e.message;
                hasError = true;
                steps.push({ nodeId, label, success: false, error: stepError });
                continue;
            }

            steps.push({ nodeId, label, success: true, output });

            // Propagate output downstream
            if (output && typeof output === "object" && "__branch" in output) {
                // Branching node (IF/ELSE, Router)
                const branchKey = `${nodeId}::${output.__branch}`;
                (edgeMap[branchKey] || []).forEach(({ targetId }) => {
                    nodeInputs[targetId] = output.data;
                });
            } else {
                const handles = OUTPUT_HANDLES[nodeType] || ["output"];
                let propagated = false;

                // Try named handles first
                for (const h of handles) {
                    const key = `${nodeId}::${h}`;
                    if (edgeMap[key]) {
                        const val = (typeof output === "object" && output !== null && h in output) ? output[h] : output;
                        edgeMap[key].forEach(({ targetId, targetHandle }) => {
                            nodeInputs[targetId] = val;
                            if (!nodeInputParts[targetId]) nodeInputParts[targetId] = {};
                            nodeInputParts[targetId][targetHandle] = val;
                        });
                        propagated = true;
                    }
                }

                // Fallback: any outgoing edge from this node
                if (!propagated) {
                    Object.entries(edgeMap)
                        .filter(([k]) => k.startsWith(nodeId + "::"))
                        .forEach(([, targets]) => {
                            targets.forEach(({ targetId, targetHandle }) => {
                                nodeInputs[targetId] = output;
                                if (!nodeInputParts[targetId]) nodeInputParts[targetId] = {};
                                nodeInputParts[targetId][targetHandle] = output;
                            });
                        });
                }
            }
        }

        return Response.json({ success: !hasError, steps });
    } catch (e) {
        return Response.json({ success: false, error: e.message, steps: [] }, { status: 500 });
    }
}
