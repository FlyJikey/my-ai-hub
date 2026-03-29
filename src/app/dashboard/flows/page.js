"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
    ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState,
    addEdge, Handle, Position, BackgroundVariant, Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    Plus, Save, Play, Trash2, ChevronRight, ChevronDown, Upload, Globe,
    Zap, GitBranch, Database, Code, Send, X, CheckCircle, AlertCircle,
    RefreshCw, Eye, Loader, FileText, List, MessageSquare, Search, Layers,
    Cpu, Network, Mail, Hash, Shuffle, Filter, Link, Package, Settings,
} from "lucide-react";
import styles from "./page.module.css";

// ─── Providers ────────────────────────────────────────────────────────────────
const PROVIDERS = [
    { value: "groq",        label: "Groq (бесплатно)" },
    { value: "polza",       label: "Polza.ai" },
    { value: "omniroute",   label: "OmniRoute" },
    { value: "openrouter",  label: "OpenRouter" },
    { value: "huggingface", label: "HuggingFace" },
    { value: "gemini",      label: "Google Gemini" },
];

const GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama3-8b-8192",
    "llama3-70b-8192",
    "qwen-qwq-32b",
    "gemma2-9b-it",
    "mixtral-8x7b-32768",
];

// ─── Node Definitions ─────────────────────────────────────────────────────────
const NODE_DEFS = {

    // ── TRIGGERS ─────────────────────────────────────────────
    trigger_photo: {
        label: "Загрузка фото",        category: "trigger", color: "#10b981", icon: "Upload",
        inputs: [], outputs: ["photo"],
        description: "Триггер: загрузка изображения пользователем",
        configFields: [],
    },
    trigger_webhook: {
        label: "Webhook",               category: "trigger", color: "#10b981", icon: "Globe",
        inputs: [], outputs: ["data"],
        description: "Входящий HTTP-запрос (POST)",
        configFields: [
            { key: "path",   label: "URL путь",     type: "text",   placeholder: "/webhook/my-flow" },
            { key: "method", label: "HTTP метод",    type: "select", options: ["POST","GET","PUT"] },
        ],
    },
    trigger_manual: {
        label: "Ручной запуск",         category: "trigger", color: "#10b981", icon: "Play",
        inputs: [], outputs: ["data"],
        description: "Запуск вручную с произвольным JSON",
        configFields: [
            { key: "input_json", label: "Начальные данные (JSON)", type: "textarea", placeholder: '{"product": "Nike Air Max", "category": "sneakers"}' },
        ],
    },

    // ── AI — ТЕКСТ ────────────────────────────────────────────
    ai_text: {
        label: "ИИ: Текст",             category: "ai", color: "#6366f1", icon: "MessageSquare",
        inputs: ["text"], outputs: ["text"],
        description: "Генерация текста — любой провайдер и модель из настроек",
        configFields: [
            { key: "provider",      label: "Провайдер",       type: "select", options: PROVIDERS.map(p=>p.value) },
            { key: "model",         label: "Модель (ID)",     type: "text",   placeholder: "llama3-8b-8192" },
            { key: "system_prompt", label: "Системный промт", type: "textarea", placeholder: "Ты — копирайтер интернет-магазина..." },
            { key: "user_template", label: "Шаблон сообщения", type: "textarea", placeholder: "Напиши карточку товара: {{input}}" },
            { key: "temperature",   label: "Temperature",     type: "number", placeholder: "0.7" },
        ],
    },
    ai_vision: {
        label: "ИИ: Зрение (Vision)",   category: "ai", color: "#6366f1", icon: "Eye",
        inputs: ["photo"], outputs: ["json"],
        description: "Анализ изображения — возвращает JSON с данными товара",
        configFields: [
            { key: "provider",  label: "Провайдер", type: "select", options: ["gemini","polza","omniroute","openrouter","huggingface"] },
            { key: "model",     label: "Модель",    type: "text",   placeholder: "gemini-1.5-flash" },
            { key: "mode",      label: "Режим",     type: "select", options: ["full","price_tag","chat"] },
        ],
    },
    ai_generate: {
        label: "ИИ: Генератор",         category: "ai", color: "#6366f1", icon: "Layers",
        inputs: ["photo"], outputs: ["text","json"],
        description: "Полный пайплайн Vision + Text — как страница Генератор",
        configFields: [
            { key: "scenario",       label: "Сценарий",          type: "select", options: ["seo_full","short_desc","advantages","compare","creative","ecommerce_pro"] },
            { key: "vision_provider",label: "Провайдер (Vision)", type: "select", options: ["gemini","polza","omniroute","openrouter"] },
            { key: "vision_model",   label: "Модель Vision",      type: "text",   placeholder: "gemini-1.5-flash" },
            { key: "text_provider",  label: "Провайдер (Текст)",  type: "select", options: PROVIDERS.map(p=>p.value) },
            { key: "text_model",     label: "Модель Текст",       type: "text",   placeholder: "llama3-8b-8192" },
        ],
    },
    ai_embed: {
        label: "ИИ: Эмбеддинг",         category: "ai", color: "#6366f1", icon: "Hash",
        inputs: ["text"], outputs: ["vector"],
        description: "Создаёт векторное представление текста",
        configFields: [
            { key: "model", label: "Модель", type: "text", placeholder: "openai/text-embedding-3-small" },
        ],
    },
    ai_ocr: {
        label: "ИИ: OCR (ценник)",      category: "ai", color: "#6366f1", icon: "Scan",
        inputs: ["photo"], outputs: ["json"],
        description: "Извлекает текст и данные с ценника / этикетки",
        configFields: [
            { key: "provider", label: "Провайдер", type: "select", options: ["gemini","polza","omniroute","openrouter"] },
            { key: "model",    label: "Модель",    type: "text",   placeholder: "gemini-1.5-flash" },
        ],
    },

    // ── КАТАЛОГ ───────────────────────────────────────────────
    catalog_search: {
        label: "Каталог: Поиск",        category: "catalog", color: "#f97316", icon: "Search",
        inputs: ["text"], outputs: ["results"],
        description: "Семантический поиск по базе товаров",
        configFields: [
            { key: "limit",    label: "Лимит результатов", type: "number", placeholder: "5" },
            { key: "semantic", label: "Семантический поиск", type: "select", options: ["true","false"] },
        ],
    },
    catalog_ask: {
        label: "Каталог: Вопрос",       category: "catalog", color: "#f97316", icon: "MessageSquare",
        inputs: ["text"], outputs: ["text"],
        description: "Задаёт вопрос к каталогу и получает ответ ИИ",
        configFields: [
            { key: "provider", label: "Провайдер", type: "select", options: PROVIDERS.map(p=>p.value) },
            { key: "model",    label: "Модель",    type: "text",   placeholder: "llama3-8b-8192" },
            { key: "style",    label: "Стиль ответа", type: "select", options: ["concise","formal","creative","normal"] },
        ],
    },
    catalog_add: {
        label: "Каталог: Добавить",     category: "catalog", color: "#f97316", icon: "Package",
        inputs: ["json"], outputs: ["result"],
        description: "Добавляет товар в базу каталога",
        configFields: [
            { key: "mapping", label: "Маппинг полей (JSON)", type: "textarea", placeholder: '{"sku":"{{input.sku}}","name":"{{input.name}}","category":"{{input.category}}","description":"{{input}}"}' },
        ],
    },

    // ── ЛОГИКА ────────────────────────────────────────────────
    logic_ifelse: {
        label: "IF / ELSE",             category: "logic", color: "#f59e0b", icon: "GitBranch",
        inputs: ["input"], outputs: ["true","false"],
        description: "Условный переход по значению поля",
        configFields: [
            { key: "field",    label: "Поле",     type: "text",   placeholder: "category" },
            { key: "operator", label: "Оператор", type: "select", options: ["contains","equals","not_equals","starts_with","gt","lt"] },
            { key: "value",    label: "Значение", type: "text",   placeholder: "кроссовки" },
        ],
    },
    logic_router: {
        label: "Маршрутизатор",         category: "logic", color: "#f59e0b", icon: "Shuffle",
        inputs: ["input"], outputs: ["route_1","route_2","route_3"],
        description: "Разветвляет по значению поля (3 маршрута)",
        configFields: [
            { key: "field",         label: "Поле",           type: "text", placeholder: "category" },
            { key: "route_1_value", label: "→ Маршрут 1",    type: "text", placeholder: "обувь" },
            { key: "route_2_value", label: "→ Маршрут 2",    type: "text", placeholder: "одежда" },
            { key: "route_3_value", label: "→ Маршрут 3 (*)", type: "text", placeholder: "* (остальное)" },
        ],
    },
    logic_merge: {
        label: "Объединить",            category: "logic", color: "#f59e0b", icon: "Filter",
        inputs: ["a","b","c"], outputs: ["merged"],
        description: "Объединяет данные из нескольких веток в один объект",
        configFields: [
            { key: "keys", label: "Имена ключей (через запятую)", type: "text", placeholder: "vision_result, text_result" },
        ],
    },
    logic_transform: {
        label: "Трансформация",         category: "logic", color: "#f59e0b", icon: "Code",
        inputs: ["input"], outputs: ["output"],
        description: "Преобразует данные по шаблону (extract поля, rename)",
        configFields: [
            { key: "extract", label: "Извлечь поле (dot-notation)", type: "text",     placeholder: "data.items.0.name" },
            { key: "template",label: "Или шаблон строки",           type: "textarea", placeholder: "{{input.name}} — {{input.category}}" },
        ],
    },

    // ── ДАННЫЕ ────────────────────────────────────────────────
    data_json_parser: {
        label: "JSON Парсер",           category: "data", color: "#06b6d4", icon: "Code",
        inputs: ["text"], outputs: ["json"],
        description: "Парсит JSON из текста или извлекает поле",
        configFields: [
            { key: "extract_field", label: "Извлечь поле (опционально)", type: "text", placeholder: "data.items.0" },
        ],
    },
    data_template: {
        label: "Шаблон текста",         category: "data", color: "#06b6d4", icon: "FileText",
        inputs: ["input"], outputs: ["text"],
        description: "Формирует строку из шаблона с переменными {{input.field}}",
        configFields: [
            { key: "template", label: "Шаблон", type: "textarea", placeholder: "Товар: {{input.name}}\nЦена: {{input.price}} ₽\nКатегория: {{input.category}}" },
        ],
    },
    data_supabase_insert: {
        label: "Supabase: Вставка",     category: "data", color: "#06b6d4", icon: "Database",
        inputs: ["data"], outputs: ["result"],
        description: "INSERT в таблицу Supabase",
        configFields: [
            { key: "table",   label: "Таблица",              type: "text",     placeholder: "products" },
            { key: "mapping", label: "Маппинг полей (JSON)",  type: "textarea", placeholder: '{"name":"{{input.name}}","category":"{{input.category}}"}' },
        ],
    },
    data_supabase_query: {
        label: "Supabase: Запрос",      category: "data", color: "#06b6d4", icon: "Database",
        inputs: ["input"], outputs: ["rows"],
        description: "SELECT из таблицы Supabase с фильтром",
        configFields: [
            { key: "table",  label: "Таблица",               type: "text",     placeholder: "products" },
            { key: "filter", label: "Фильтр (eq: поле=знач)", type: "text",    placeholder: "category=кроссовки" },
            { key: "limit",  label: "Лимит строк",           type: "number",   placeholder: "10" },
            { key: "select", label: "Поля (через запятую)",  type: "text",     placeholder: "id,name,category,price" },
        ],
    },

    // ── ИНТЕГРАЦИИ ────────────────────────────────────────────
    int_telegram: {
        label: "Telegram: Отправить",   category: "integration", color: "#3b82f6", icon: "Send",
        inputs: ["data"], outputs: [],
        description: "Отправляет сообщение в Telegram (токен из Настроек)",
        configFields: [
            { key: "chat_id",  label: "Chat ID",         type: "text",     placeholder: "-1001234567890" },
            { key: "template", label: "Шаблон сообщения", type: "textarea", placeholder: "🛍 Новый товар: {{input.name}}\nКатегория: {{input.category}}" },
            { key: "parse_mode", label: "Форматирование", type: "select",  options: ["HTML","Markdown","None"] },
        ],
    },
    int_http: {
        label: "HTTP Запрос",           category: "integration", color: "#3b82f6", icon: "Globe",
        inputs: ["data"], outputs: ["response"],
        description: "Произвольный HTTP GET/POST к любому API",
        configFields: [
            { key: "url",     label: "URL",          type: "text",     placeholder: "https://api.example.com/items" },
            { key: "method",  label: "Метод",        type: "select",   options: ["POST","GET","PUT","PATCH","DELETE"] },
            { key: "headers", label: "Заголовки (JSON)", type: "textarea", placeholder: '{"Authorization":"Bearer {{settings.token}}","Content-Type":"application/json"}' },
            { key: "body_template", label: "Body (JSON шаблон)", type: "textarea", placeholder: '{"name":"{{input.name}}","price":{{input.price}}}' },
        ],
    },
    int_discord: {
        label: "Discord Webhook",       category: "integration", color: "#3b82f6", icon: "Hash",
        inputs: ["data"], outputs: [],
        description: "Отправляет embed в Discord канал через Webhook",
        configFields: [
            { key: "webhook_url", label: "Webhook URL", type: "text",     placeholder: "https://discord.com/api/webhooks/..." },
            { key: "content",     label: "Сообщение",    type: "textarea", placeholder: "**{{input.name}}** — {{input.category}}" },
            { key: "username",    label: "Имя бота",     type: "text",     placeholder: "AI Hub Bot" },
        ],
    },
    int_slack: {
        label: "Slack Webhook",         category: "integration", color: "#3b82f6", icon: "Hash",
        inputs: ["data"], outputs: [],
        description: "Отправляет сообщение в Slack через Incoming Webhook",
        configFields: [
            { key: "webhook_url", label: "Webhook URL", type: "text",     placeholder: "https://hooks.slack.com/services/..." },
            { key: "text",        label: "Текст",        type: "textarea", placeholder: "Новый товар: *{{input.name}}*" },
            { key: "channel",     label: "Канал",        type: "text",     placeholder: "#products" },
        ],
    },
    int_email: {
        label: "Email (SMTP)",          category: "integration", color: "#3b82f6", icon: "Mail",
        inputs: ["data"], outputs: [],
        description: "Отправляет email (SMTP настройки из Интеграций)",
        configFields: [
            { key: "to",       label: "Кому (email)", type: "text",     placeholder: "manager@shop.ru" },
            { key: "subject",  label: "Тема",          type: "text",     placeholder: "Новый товар: {{input.name}}" },
            { key: "body",     label: "Тело письма",   type: "textarea", placeholder: "Товар добавлен:\n{{input.name}}\nОписание: {{input.description}}" },
        ],
    },
};

const CATEGORIES = [
    { key: "trigger",     label: "Триггеры",           color: "#10b981" },
    { key: "ai",          label: "ИИ Модели",           color: "#6366f1" },
    { key: "catalog",     label: "Каталог товаров",     color: "#f97316" },
    { key: "logic",       label: "Логика",              color: "#f59e0b" },
    { key: "data",        label: "Данные / База",       color: "#06b6d4" },
    { key: "integration", label: "Интеграции",          color: "#3b82f6" },
];

const ICON_MAP = {
    Upload, Globe, Eye, Zap, GitBranch, Database, Code, Send, MessageSquare,
    Search, Layers, Cpu, Network, Mail, Hash, Shuffle, Filter, Link, Package,
    Settings, FileText, List, Plus, Play,
};

function getIcon(name) {
    return ICON_MAP[name] || Zap;
}

// ─── Custom Node Component ─────────────────────────────────────────────────────
function FlowNode({ data, selected }) {
    const def = NODE_DEFS[data.nodeType] || {};
    const IconComp = getIcon(def.icon);
    const color = def.color || "#6366f1";

    return (
        <div className={`${styles.flowNode} ${selected ? styles.flowNodeSelected : ""}`}
            style={{ "--node-color": color }}>

            {(def.inputs || []).map((port, i) => (
                <Handle key={`in-${port}`} type="target" position={Position.Left} id={port}
                    style={{ top: `${((i + 1) / ((def.inputs.length || 1) + 1)) * 100}%`, background: color }}
                    title={port} />
            ))}

            <div className={styles.flowNodeHeader} style={{ background: color + "22", borderBottom: `1px solid ${color}44` }}>
                <div className={styles.flowNodeIcon} style={{ color }}>
                    <IconComp size={14} />
                </div>
                <span className={styles.flowNodeLabel}>{data.label || def.label}</span>
                {def.category === "trigger" && (
                    <span className={styles.flowNodeBadge} style={{ background: color + "33", color }}>trigger</span>
                )}
            </div>

            {data.config && Object.keys(data.config).length > 0 && (
                <div className={styles.flowNodeBody}>
                    {Object.entries(data.config).slice(0, 2).map(([k, v]) => v ? (
                        <div key={k} className={styles.flowNodeConfigPreview}>
                            <span className={styles.flowNodeConfigKey}>{k}:</span>
                            <span className={styles.flowNodeConfigVal}>{String(v).slice(0, 28)}{String(v).length > 28 ? "…" : ""}</span>
                        </div>
                    ) : null)}
                </div>
            )}

            {(def.outputs || []).map((port, i) => (
                <Handle key={`out-${port}`} type="source" position={Position.Right} id={port}
                    style={{ top: `${((i + 1) / ((def.outputs.length || 1) + 1)) * 100}%`, background: color }}
                    title={port} />
            ))}
        </div>
    );
}

const nodeTypes = { flowNode: FlowNode };

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FlowsPage() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [openCategories, setOpenCategories] = useState({ trigger: true, ai: true, catalog: false, logic: false, data: false, integration: false });
    const [flows, setFlows] = useState([]);
    const [currentFlowId, setCurrentFlowId] = useState(null);
    const [currentFlowName, setCurrentFlowName] = useState("Новый поток");
    const [showFlowList, setShowFlowList] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [execResult, setExecResult] = useState(null);
    const [message, setMessage] = useState({ text: "", type: "" });
    const [uploadedPhoto, setUploadedPhoto] = useState(null);
    const [panelSearch, setPanelSearch] = useState("");
    const reactFlowWrapper = useRef(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    useEffect(() => { fetchFlows(); }, []);

    const fetchFlows = async () => {
        try {
            const res = await fetch("/api/flows");
            if (res.ok) { const d = await res.json(); setFlows(d.flows || []); }
        } catch (e) { }
    };

    const showMsg = (text, type = "success") => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: "", type: "" }), 3500);
    };

    const onDragStart = (e, nodeType) => {
        e.dataTransfer.setData("application/reactflow", nodeType);
        e.dataTransfer.effectAllowed = "move";
    };

    const onDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData("application/reactflow");
        if (!type || !reactFlowInstance) return;
        const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const def = NODE_DEFS[type];
        const id = `node_${Date.now()}`;
        setNodes((nds) => nds.concat({
            id, type: "flowNode", position,
            data: { nodeType: type, label: def.label, config: {} },
        }));
    }, [reactFlowInstance, setNodes]);

    const onConnect = useCallback((params) => {
        setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#6366f1" } }, eds));
    }, [setEdges]);

    const onNodeClick = useCallback((_, node) => setSelectedNode(node), []);
    const onPaneClick = useCallback(() => setSelectedNode(null), []);

    const updateNodeConfig = (key, value) => {
        if (!selectedNode) return;
        setNodes((nds) => nds.map((n) => {
            if (n.id === selectedNode.id) {
                const updated = { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } };
                setSelectedNode(updated);
                return updated;
            }
            return n;
        }));
    };

    const updateNodeLabel = (value) => {
        if (!selectedNode) return;
        setNodes((nds) => nds.map((n) => {
            if (n.id === selectedNode.id) {
                const updated = { ...n, data: { ...n.data, label: value } };
                setSelectedNode(updated);
                return updated;
            }
            return n;
        }));
    };

    const deleteSelectedNode = () => {
        if (!selectedNode) return;
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
        setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
        setSelectedNode(null);
    };

    const saveFlow = async () => {
        setIsSaving(true);
        try {
            const body = { name: currentFlowName, nodes, edges };
            const url = currentFlowId ? `/api/flows/${currentFlowId}` : "/api/flows";
            const method = currentFlowId ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (res.ok) {
                const d = await res.json();
                if (!currentFlowId) setCurrentFlowId(d.id);
                showMsg("Поток сохранён!");
                fetchFlows();
            } else showMsg("Ошибка сохранения", "error");
        } catch (e) { showMsg("Ошибка сохранения", "error"); }
        finally { setIsSaving(false); }
    };

    const loadFlow = (flow) => {
        setCurrentFlowId(flow.id);
        setCurrentFlowName(flow.name);
        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);
        setShowFlowList(false);
        setSelectedNode(null);
        showMsg(`Загружен: "${flow.name}"`);
    };

    const newFlow = () => {
        setCurrentFlowId(null);
        setCurrentFlowName("Новый поток");
        setNodes([]); setEdges([]);
        setSelectedNode(null);
        setExecResult(null);
        setShowFlowList(false);
    };

    const executeFlow = async () => {
        if (nodes.length === 0) { showMsg("Добавьте узлы на холст", "error"); return; }
        setIsExecuting(true);
        setExecResult(null);
        try {
            const formData = new FormData();
            formData.append("flow", JSON.stringify({ nodes, edges }));
            if (uploadedPhoto) formData.append("photo", uploadedPhoto);
            const res = await fetch("/api/flows/execute", { method: "POST", body: formData });
            const d = await res.json();
            setExecResult(d);
            if (d.success) showMsg("Поток выполнен!");
            else showMsg(d.error || "Ошибка выполнения", "error");
        } catch (e) { showMsg("Ошибка: " + e.message, "error"); }
        finally { setIsExecuting(false); }
    };

    const loadDemo = () => {
        const demo = {
            name: "Пример: Магазин кроссовок",
            nodes: [
                { id: "n1", type: "flowNode", position: { x: 50, y: 160 },  data: { nodeType: "trigger_photo",  label: "Загрузка фото", config: {} } },
                { id: "n2", type: "flowNode", position: { x: 300, y: 160 }, data: { nodeType: "ai_vision",      label: "Анализ фото",   config: { provider: "gemini", model: "gemini-1.5-flash", mode: "full" } } },
                { id: "n3", type: "flowNode", position: { x: 560, y: 160 }, data: { nodeType: "logic_ifelse",   label: "Это кроссовки?", config: { field: "category", operator: "contains", value: "кроссовк" } } },
                { id: "n4", type: "flowNode", position: { x: 820, y: 60 },  data: { nodeType: "ai_text",        label: "Карточка SPORT", config: { provider: "groq", model: "llama3-70b-8192", system_prompt: "Ты копирайтер спортивного магазина.", user_template: "Напиши продающую карточку: {{input}}" } } },
                { id: "n5", type: "flowNode", position: { x: 820, y: 300 }, data: { nodeType: "ai_text",        label: "Карточка BLOG",  config: { provider: "groq", model: "llama3-8b-8192",  system_prompt: "Ты блогер о моде.", user_template: "Напиши пост для блога: {{input}}" } } },
                { id: "n6", type: "flowNode", position: { x: 1080, y: 160 },data: { nodeType: "data_supabase_insert", label: "Сохранить в БД", config: { table: "products", mapping: '{"name":"{{input.name}}","description":"{{input}}"}' } } },
            ],
            edges: [
                { id: "e1", source: "n1", sourceHandle: "photo",  target: "n2", targetHandle: "photo",  animated: true, style: { stroke: "#6366f1" } },
                { id: "e2", source: "n2", sourceHandle: "json",   target: "n3", targetHandle: "input",  animated: true, style: { stroke: "#6366f1" } },
                { id: "e3", source: "n3", sourceHandle: "true",   target: "n4", targetHandle: "text",   animated: true, style: { stroke: "#10b981" } },
                { id: "e4", source: "n3", sourceHandle: "false",  target: "n5", targetHandle: "text",   animated: true, style: { stroke: "#ef4444" } },
                { id: "e5", source: "n4", sourceHandle: "text",   target: "n6", targetHandle: "data",   animated: true, style: { stroke: "#6366f1" } },
                { id: "e6", source: "n5", sourceHandle: "text",   target: "n6", targetHandle: "data",   animated: true, style: { stroke: "#6366f1" } },
            ],
        };
        setCurrentFlowId(null); setCurrentFlowName(demo.name);
        setNodes(demo.nodes); setEdges(demo.edges);
        setSelectedNode(null); showMsg("Демо-поток загружен!");
    };

    // Filtered node list for panel search
    const filteredDefs = panelSearch
        ? Object.entries(NODE_DEFS).filter(([, d]) =>
            d.label.toLowerCase().includes(panelSearch.toLowerCase()) ||
            d.description.toLowerCase().includes(panelSearch.toLowerCase()))
        : null;

    const def = selectedNode ? NODE_DEFS[selectedNode.data.nodeType] : null;

    return (
        <div className={styles.page}>
            {/* ── Top Bar ── */}
            <div className={styles.topBar}>
                <div className={styles.topBarLeft}>
                    <input className={styles.flowNameInput} value={currentFlowName}
                        onChange={(e) => setCurrentFlowName(e.target.value)} />
                    <button className={styles.btnOutline} onClick={() => setShowFlowList(!showFlowList)}>
                        <List size={14} /> Потоки
                    </button>
                    <button className={styles.btnOutline} onClick={newFlow}>
                        <Plus size={14} /> Новый
                    </button>
                    <button className={styles.btnOutline} onClick={loadDemo}>
                        <FileText size={14} /> Демо
                    </button>
                </div>
                <div className={styles.topBarRight}>
                    {message.text && (
                        <div className={`${styles.msg} ${message.type === "error" ? styles.msgError : styles.msgSuccess}`}>
                            {message.type === "error" ? <AlertCircle size={13} /> : <CheckCircle size={13} />}
                            {message.text}
                        </div>
                    )}
                    <button className={styles.btnSave} onClick={saveFlow} disabled={isSaving}>
                        {isSaving ? <RefreshCw size={14} className={styles.spin} /> : <Save size={14} />} Сохранить
                    </button>
                    <button className={styles.btnRun} onClick={executeFlow} disabled={isExecuting}>
                        {isExecuting ? <Loader size={14} className={styles.spin} /> : <Play size={14} />} Запустить
                    </button>
                </div>
            </div>

            {showFlowList && (
                <div className={styles.flowListDropdown}>
                    {flows.length === 0
                        ? <div className={styles.flowListEmpty}>Нет сохранённых потоков</div>
                        : flows.map((f) => (
                            <div key={f.id} className={styles.flowListItem} onClick={() => loadFlow(f)}>
                                <span>{f.name}</span>
                                <span className={styles.flowListDate}>{new Date(f.updated_at || f.created_at).toLocaleDateString("ru")}</span>
                            </div>
                        ))}
                </div>
            )}

            <div className={styles.editorArea}>
                {/* ── Left Panel ── */}
                <div className={styles.nodePanel}>
                    <div className={styles.nodePanelTitle}>Узлы</div>

                    {/* Search */}
                    <div className={styles.panelSearch}>
                        <Search size={11} className={styles.panelSearchIcon} />
                        <input className={styles.panelSearchInput} placeholder="Поиск узлов…"
                            value={panelSearch} onChange={e => setPanelSearch(e.target.value)} />
                        {panelSearch && <button className={styles.panelSearchClear} onClick={() => setPanelSearch("")}><X size={10} /></button>}
                    </div>

                    {/* Filtered results */}
                    {filteredDefs ? (
                        <div className={styles.nodeCategoryList} style={{ paddingLeft: 0 }}>
                            {filteredDefs.map(([type, d]) => {
                                const IconComp = getIcon(d.icon);
                                return (
                                    <div key={type} className={styles.nodePanelItem} draggable
                                        onDragStart={(e) => onDragStart(e, type)}
                                        style={{ "--item-color": d.color }} title={d.description}>
                                        <IconComp size={12} style={{ color: d.color, flexShrink: 0 }} />
                                        <span>{d.label}</span>
                                    </div>
                                );
                            })}
                            {filteredDefs.length === 0 && <div className={styles.flowListEmpty}>Не найдено</div>}
                        </div>
                    ) : (
                        CATEGORIES.map((cat) => (
                            <div key={cat.key} className={styles.nodeCategory}>
                                <button className={styles.nodeCategoryHeader}
                                    onClick={() => setOpenCategories((p) => ({ ...p, [cat.key]: !p[cat.key] }))}>
                                    <span style={{ color: cat.color }}>{cat.label}</span>
                                    {openCategories[cat.key] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                </button>
                                {openCategories[cat.key] && (
                                    <div className={styles.nodeCategoryList}>
                                        {Object.entries(NODE_DEFS)
                                            .filter(([, d]) => d.category === cat.key)
                                            .map(([type, d]) => {
                                                const IconComp = getIcon(d.icon);
                                                return (
                                                    <div key={type} className={styles.nodePanelItem} draggable
                                                        onDragStart={(e) => onDragStart(e, type)}
                                                        style={{ "--item-color": d.color }} title={d.description}>
                                                        <IconComp size={12} style={{ color: d.color, flexShrink: 0 }} />
                                                        <span>{d.label}</span>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {/* Test photo */}
                    <div className={styles.testPhotoSection}>
                        <div className={styles.nodePanelTitle} style={{ marginTop: 8 }}>Тест: фото</div>
                        <label className={styles.photoUploadLabel}>
                            <Upload size={12} />
                            {uploadedPhoto ? uploadedPhoto.name : "Выбрать файл"}
                            <input type="file" accept="image/*" className={styles.hiddenInput}
                                onChange={(e) => setUploadedPhoto(e.target.files[0])} />
                        </label>
                        {uploadedPhoto && (
                            <button className={styles.clearPhotoBtn} onClick={() => setUploadedPhoto(null)}>
                                <X size={11} /> Убрать
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Canvas ── */}
                <div className={styles.canvasWrap} ref={reactFlowWrapper}>
                    <ReactFlow nodes={nodes} edges={edges}
                        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                        onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver}
                        onInit={setReactFlowInstance} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes} fitView colorMode="dark" deleteKeyCode="Delete"
                        proOptions={{ hideAttribution: true }}>
                        <Background variant={BackgroundVariant.Dots} color="#333" gap={20} size={1} />
                        <Controls />
                        <MiniMap nodeColor={(n) => NODE_DEFS[n.data?.nodeType]?.color || "#6366f1"}
                            style={{ background: "#1a1a2e" }} maskColor="rgba(0,0,0,0.5)" />
                        <Panel position="top-center">
                            {nodes.length === 0 && (
                                <div className={styles.emptyHint}>
                                    Перетащите узлы из левой панели или нажмите «Демо»
                                </div>
                            )}
                        </Panel>
                    </ReactFlow>
                </div>

                {/* ── Right Panel: Config ── */}
                {selectedNode && def && (
                    <div className={styles.configPanel}>
                        <div className={styles.configPanelHeader}>
                            <span className={styles.configPanelTitle}>Настройка</span>
                            <button className={styles.configCloseBtn} onClick={() => setSelectedNode(null)}><X size={14} /></button>
                        </div>
                        <div className={styles.configNodeType} style={{ color: def.color }}>{def.label}</div>
                        <p className={styles.configDesc}>{def.description}</p>

                        <div className={styles.configField}>
                            <label className={styles.configLabel}>Название узла</label>
                            <input className={styles.configInput} value={selectedNode.data.label || ""}
                                onChange={(e) => updateNodeLabel(e.target.value)} />
                        </div>

                        {(def.configFields || []).map((field) => (
                            <div key={field.key} className={styles.configField}>
                                <label className={styles.configLabel}>{field.label}</label>
                                {field.type === "textarea" ? (
                                    <textarea className={styles.configTextarea} rows={4}
                                        value={selectedNode.data.config?.[field.key] || ""}
                                        onChange={(e) => updateNodeConfig(field.key, e.target.value)}
                                        placeholder={field.placeholder} />
                                ) : field.type === "select" ? (
                                    <select className={styles.configSelect}
                                        value={selectedNode.data.config?.[field.key] || ""}
                                        onChange={(e) => updateNodeConfig(field.key, e.target.value)}>
                                        <option value="">— выбрать —</option>
                                        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ) : (
                                    <input className={styles.configInput} type={field.type || "text"}
                                        value={selectedNode.data.config?.[field.key] || ""}
                                        onChange={(e) => updateNodeConfig(field.key, e.target.value)}
                                        placeholder={field.placeholder} />
                                )}
                            </div>
                        ))}

                        {(def.inputs.length > 0 || def.outputs.length > 0) && (
                            <div className={styles.configPortInfo}>
                                {def.inputs.length > 0 && <div><strong>Входы:</strong> {def.inputs.join(", ")}</div>}
                                {def.outputs.length > 0 && <div><strong>Выходы:</strong> {def.outputs.join(", ")}</div>}
                            </div>
                        )}

                        <button className={styles.deleteNodeBtn} onClick={deleteSelectedNode}>
                            <Trash2 size={13} /> Удалить узел
                        </button>
                    </div>
                )}

                {/* ── Execution Result ── */}
                {execResult && !selectedNode && (
                    <div className={styles.configPanel}>
                        <div className={styles.configPanelHeader}>
                            <span className={styles.configPanelTitle}>Результат</span>
                            <button className={styles.configCloseBtn} onClick={() => setExecResult(null)}><X size={14} /></button>
                        </div>
                        <div className={`${styles.execStatus} ${execResult.success ? styles.execSuccess : styles.execError}`}>
                            {execResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            {execResult.success ? "Успешно" : "Ошибка"}
                        </div>
                        {(execResult.steps || []).map((step, i) => (
                            <div key={i} className={styles.execStep}>
                                <div className={styles.execStepHeader}>
                                    <span className={styles.execStepName}>{step.label}</span>
                                    <span className={`${styles.execStepStatus} ${step.success ? styles.execStepOk : styles.execStepFail}`}>
                                        {step.success ? "✓" : "✗"}
                                    </span>
                                </div>
                                {step.output && (
                                    <pre className={styles.execStepOutput}>
                                        {typeof step.output === "string"
                                            ? step.output.slice(0, 400)
                                            : JSON.stringify(step.output, null, 2).slice(0, 400)}
                                        {JSON.stringify(step.output || "").length > 400 ? "\n…" : ""}
                                    </pre>
                                )}
                                {step.error && <div className={styles.execStepError}>{step.error}</div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
