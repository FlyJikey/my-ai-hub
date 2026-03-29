"use client";

import { createElement, useState, useCallback, useRef, useEffect } from "react";
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
    HelpCircle, ChevronLeft, BookOpen,
} from "lucide-react";
import styles from "./page.module.css";
import { useTheme } from "../../context/ThemeContext";

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

function NodeIcon({ name, ...props }) {
    return createElement(getIcon(name), props);
}

// ─── Custom Node Component ─────────────────────────────────────────────────────
function FlowNode({ data, selected }) {
    const def = NODE_DEFS[data.nodeType] || {};
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
                    <NodeIcon name={def.icon} size={14} />
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
    const { resolvedTheme } = useTheme();
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
    const [aiSettings, setAiSettings] = useState(null);
    const [showHelp, setShowHelp] = useState(false);
    const [helpPage, setHelpPage] = useState("main");
    const [isDirty, setIsDirty] = useState(false);
    const reactFlowWrapper = useRef(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    // Modal для подтверждения при уходе с несохранёнными изменениями
    const [showNavConfirm, setShowNavConfirm] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState(null);

    // Refs для актуальных данных при размонтировании
    const nodesRef = useRef([]);
    const edgesRef = useRef([]);
    const flowNameRef = useRef("Новый поток");
    const flowIdRef = useRef(null);

    // Restore draft from localStorage on mount
    useEffect(() => {
        fetchFlows();
        fetchAiSettings();
        try {
            const draft = localStorage.getItem("flows-draft");
            if (draft) {
                const d = JSON.parse(draft);
                setCurrentFlowName(d.name || "Новый поток");
                setCurrentFlowId(d.flowId || null);
                setNodes(d.nodes || []);
                setEdges(d.edges || []);
                setIsDirty(true);
            }
        } catch (e) { }
    }, []);

    // Auto-save draft to localStorage (debounced 800ms)
    useEffect(() => {
        if (nodes.length === 0 && edges.length === 0) return;
        const t = setTimeout(() => {
            try {
                localStorage.setItem("flows-draft", JSON.stringify({
                    name: currentFlowName, nodes, edges, flowId: currentFlowId
                }));
            } catch (e) { }
            setIsDirty(true);
        }, 800);
        return () => clearTimeout(t);
    }, [nodes, edges]);

    // Синхронно обновлять refs с текущими данными
    useEffect(() => {
        nodesRef.current = nodes;
        edgesRef.current = edges;
        flowNameRef.current = currentFlowName;
        flowIdRef.current = currentFlowId;
    }, [nodes, edges, currentFlowName, currentFlowId]);

    // Сохранять черновик при размонтировании компонента
    useEffect(() => {
        return () => {
            if (nodesRef.current.length > 0 || edgesRef.current.length > 0) {
                try {
                    localStorage.setItem("flows-draft", JSON.stringify({
                        name: flowNameRef.current,
                        nodes: nodesRef.current,
                        edges: edgesRef.current,
                        flowId: flowIdRef.current,
                    }));
                } catch (e) { }
            }
        };
    }, []);

    // Warn on browser unload when dirty
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty) { e.preventDefault(); e.returnValue = ""; }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    // Перехватывать клики на навигационные ссылки, если есть несохранённые изменения
    useEffect(() => {
        const handleLinkClick = (e) => {
            if (!isDirty) return;

            const link = e.target.closest('a[href]');
            if (!link) return;

            const href = link.getAttribute('href');
            // Если это не ссылка на flows, показать подтверждение
            if (href && !href.includes('/flows')) {
                e.preventDefault();
                setPendingNavigation(href);
                setShowNavConfirm(true);
            }
        };

        document.addEventListener('click', handleLinkClick, true);
        return () => document.removeEventListener('click', handleLinkClick, true);
    }, [isDirty]);

    const fetchFlows = async () => {
        try {
            const res = await fetch("/api/flows");
            if (res.ok) { const d = await res.json(); setFlows(d.flows || []); }
        } catch (e) { }
    };

    const fetchAiSettings = async () => {
        try {
            const res = await fetch("/api/settings");
            if (res.ok) { const d = await res.json(); setAiSettings(d); }
        } catch (e) { }
    };

    // Returns models from settings filtered by provider and node type
    const getModelsForField = (fieldKey, nodeType) => {
        if (!aiSettings) return [];
        const providerKey = fieldKey === "vision_model" ? "vision_provider" : fieldKey === "text_model" ? "text_provider" : "provider";
        const provider = selectedNode?.data?.config?.[providerKey];
        if (!provider) return [];

        // Decide which model list to use
        let modelList;
        if (["ai_vision", "ai_ocr"].includes(nodeType) || fieldKey === "vision_model") {
            modelList = aiSettings.visionModels || [];
        } else if (nodeType === "ai_embed") {
            modelList = aiSettings.embeddingModels || [];
        } else {
            modelList = aiSettings.textModels || [];
        }

        return modelList.filter(m => m.enabled !== false && m.provider === provider);
    };

    const isModelField = (fieldKey) => ["model", "vision_model", "text_model"].includes(fieldKey);

    const showMsg = (text, type = "success") => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: "", type: "" }), 3500);
    };

    const handleNavConfirmSave = async () => {
        setShowNavConfirm(false);
        await handleSave();
        if (pendingNavigation) {
            window.location.href = pendingNavigation;
        }
    };

    const handleNavConfirmDontSave = () => {
        setShowNavConfirm(false);
        if (pendingNavigation) {
            window.location.href = pendingNavigation;
        }
    };

    const handleNavConfirmCancel = () => {
        setShowNavConfirm(false);
        setPendingNavigation(null);
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
                localStorage.removeItem("flows-draft");
                setIsDirty(false);
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
        localStorage.removeItem("flows-draft");
        setIsDirty(false);
        setShowFlowList(false);
        setSelectedNode(null);
        showMsg(`Загружен: "${flow.name}"`);
    };

    const newFlow = () => {
        setCurrentFlowId(null);
        setCurrentFlowName("Новый поток");
        setNodes([]); setEdges([]);
        localStorage.removeItem("flows-draft");
        setIsDirty(false);
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
                    {isDirty && !message.text && (
                        <span style={{ fontSize: 11, color: "var(--warning)" }}>● не сохранено</span>
                    )}
                    {message.text && (
                        <div className={`${styles.msg} ${message.type === "error" ? styles.msgError : styles.msgSuccess}`}>
                            {message.type === "error" ? <AlertCircle size={13} /> : <CheckCircle size={13} />}
                            {message.text}
                        </div>
                    )}
                    <button className={styles.btnHelp} onClick={() => { setShowHelp(true); setHelpPage("main"); }}
                        title="Справка">
                        <HelpCircle size={15} />
                    </button>
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
                    <div className={styles.nodePanelBody}>
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
                </div>

                {/* ── Canvas ── */}
                <div className={styles.canvasWrap} ref={reactFlowWrapper}>
                    <ReactFlow nodes={nodes} edges={edges}
                        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                        onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver}
                        onInit={setReactFlowInstance} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes} fitView colorMode={resolvedTheme} deleteKeyCode="Delete"
                        proOptions={{ hideAttribution: true }}>
                        <Background variant={BackgroundVariant.Dots} color="var(--flow-grid-color)" gap={20} size={1} />
                        <Controls />
                        <MiniMap nodeColor={(n) => NODE_DEFS[n.data?.nodeType]?.color || "#6366f1"}
                            style={{ background: "var(--minimap-bg)" }} maskColor="var(--flow-minimap-mask)" />
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
                        <div className={styles.configPanelBody}>
                            <div className={styles.configNodeType} style={{ color: def.color }}>{def.label}</div>
                            <p className={styles.configDesc}>{def.description}</p>

                            <div className={styles.configField}>
                                <label className={styles.configLabel}>Название узла</label>
                                <input className={styles.configInput} value={selectedNode.data.label || ""}
                                    onChange={(e) => updateNodeLabel(e.target.value)} />
                            </div>

                            {(def.configFields || []).map((field) => {
                                const nodeType = selectedNode.data.nodeType;
                                const modelFieldModels = isModelField(field.key) ? getModelsForField(field.key, nodeType) : [];
                                const showModelDropdown = isModelField(field.key) && modelFieldModels.length > 0;

                                return (
                                <div key={field.key} className={styles.configField}>
                                    <label className={styles.configLabel}>{field.label}</label>
                                    {showModelDropdown ? (
                                        <select className={styles.configSelect}
                                            value={selectedNode.data.config?.[field.key] || ""}
                                            onChange={(e) => updateNodeConfig(field.key, e.target.value)}>
                                            <option value="">— выбрать модель —</option>
                                            {modelFieldModels.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name}{m.tier === "free" ? " (free)" : m.tier === "economy" ? " ($)" : " ($$)"}
                                                </option>
                                            ))}
                                        </select>
                                    ) : field.type === "textarea" ? (
                                        <textarea className={styles.configTextarea} rows={4}
                                            value={selectedNode.data.config?.[field.key] || ""}
                                            onChange={(e) => updateNodeConfig(field.key, e.target.value)}
                                            placeholder={field.placeholder} />
                                    ) : field.type === "select" ? (
                                        <select className={styles.configSelect}
                                            value={selectedNode.data.config?.[field.key] || ""}
                                            onChange={(e) => updateNodeConfig(field.key, e.target.value)}>
                                            <option value="">— выбрать —</option>
                                            {field.options.map((o) => {
                                                const providerMeta = field.key === "provider" || field.key.endsWith("_provider")
                                                    ? PROVIDERS.find(p => p.value === o) : null;
                                                return <option key={o} value={o}>{providerMeta ? providerMeta.label : o}</option>;
                                            })}
                                        </select>
                                    ) : (
                                        <input className={styles.configInput} type={field.type || "text"}
                                            value={selectedNode.data.config?.[field.key] || ""}
                                            onChange={(e) => updateNodeConfig(field.key, e.target.value)}
                                            placeholder={field.placeholder} />
                                    )}
                                    {isModelField(field.key) && modelFieldModels.length === 0 && selectedNode.data.config?.provider && (
                                        <span className={styles.configHint}>Нет моделей для этого провайдера в Настройках</span>
                                    )}
                                </div>
                                );
                            })}

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
                    </div>
                )}

                {/* ── Execution Result ── */}
                {execResult && !selectedNode && (
                    <div className={styles.configPanel}>
                        <div className={styles.configPanelHeader}>
                            <span className={styles.configPanelTitle}>Результат</span>
                            <button className={styles.configCloseBtn} onClick={() => setExecResult(null)}><X size={14} /></button>
                        </div>
                        <div className={styles.configPanelBody}>
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
                    </div>
                )}
            </div>

            {/* ── Navigation Confirmation Modal ── */}
            {showNavConfirm && (
                <div className={styles.navConfirmOverlay} onClick={handleNavConfirmCancel}>
                    <div className={styles.navConfirmModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.navConfirmHeader}>
                            <AlertCircle size={20} style={{ color: "#f59e0b" }} />
                            <span className={styles.navConfirmTitle}>Несохранённые изменения</span>
                        </div>
                        <p className={styles.navConfirmText}>
                            У вас есть несохранённые изменения в цепочке. Что вы хотите сделать?
                        </p>
                        <div className={styles.navConfirmButtons}>
                            <button className={styles.btnNavCancel} onClick={handleNavConfirmCancel}>
                                Остаться
                            </button>
                            <button className={styles.btnNavDontSave} onClick={handleNavConfirmDontSave}>
                                Перейти без сохранения
                            </button>
                            <button className={styles.btnNavSave} onClick={handleNavConfirmSave}>
                                Сохранить и перейти
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Help Modal ── */}
            {showHelp && <HelpModal page={helpPage} setPage={setHelpPage} onClose={() => setShowHelp(false)} />}
        </div>
    );
}

// ─── Help Modal Component ──────────────────────────────────────────────────────
const HELP_PAGES = {
    main: {
        title: "Справка: Цепочки ИИ",
        content: () => (
            <>
                <p className={styles.helpText}>
                    <strong>Цепочки ИИ</strong> — визуальный редактор автоматизаций.
                    Вы создаёте потоки из узлов, соединяете их стрелками, и при запуске данные последовательно проходят через каждый узел.
                </p>
                <h3 className={styles.helpH3}>Быстрый старт</h3>
                <ol className={styles.helpList}>
                    <li>Перетащите узел из левой панели на холст</li>
                    <li>Нажмите на узел — справа откроется панель настроек</li>
                    <li>Соедините выход одного узла со входом другого (тяните от кружка к кружку)</li>
                    <li>Нажмите «Запустить» для тестирования</li>
                    <li>Нажмите «Сохранить» чтобы сохранить поток</li>
                </ol>
                <h3 className={styles.helpH3}>Разделы справки</h3>
            </>
        ),
        links: [
            { page: "triggers",     label: "Триггеры",            desc: "С чего начинается поток" },
            { page: "ai_models",    label: "ИИ Модели",           desc: "Текст, зрение, OCR, генератор" },
            { page: "catalog",      label: "Каталог товаров",     desc: "Поиск, вопросы, добавление" },
            { page: "logic",        label: "Логика",              desc: "IF/ELSE, маршрутизатор, объединение" },
            { page: "data",         label: "Данные / База",       desc: "JSON, шаблоны, Supabase" },
            { page: "integrations", label: "Интеграции",          desc: "Telegram, HTTP, Discord, Slack, Email" },
            { page: "connections",  label: "Как соединять узлы",  desc: "Порты, типы данных, ветвление" },
            { page: "execution",    label: "Выполнение потока",   desc: "Как работает запуск и отладка" },
            { page: "tips",         label: "Советы и примеры",    desc: "Готовые сценарии автоматизации" },
        ],
    },
    triggers: {
        title: "Триггеры",
        content: () => (
            <>
                <p className={styles.helpText}>Триггеры — начальные точки потока. Каждый поток должен начинаться хотя бы с одного триггера.</p>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#10b981"}}>Загрузка фото</h4>
                    <p>Передаёт изображение следующему узлу. Для тестирования загрузите фото в секцию «Тест: фото» в левой панели.</p>
                    <p><strong>Выход:</strong> <code>photo</code> — base64-изображение</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#10b981"}}>Webhook</h4>
                    <p>Принимает внешний HTTP-запрос. Задайте URL-путь, и внешний сервис сможет запускать ваш поток автоматически.</p>
                    <p><strong>Выход:</strong> <code>data</code> — JSON из тела запроса</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#10b981"}}>Ручной запуск</h4>
                    <p>Позволяет задать начальные JSON-данные вручную. Полезно для тестирования без фото.</p>
                    <p><strong>Пример:</strong> <code>{'{"name":"Nike Air Max","category":"sneakers"}'}</code></p>
                </div>
            </>
        ),
    },
    ai_models: {
        title: "ИИ Модели",
        content: () => (
            <>
                <p className={styles.helpText}>Узлы ИИ вызывают нейросети из ваших настроек. Выберите провайдера — и список моделей загрузится автоматически.</p>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#6366f1"}}>ИИ: Текст</h4>
                    <p>Генерирует текст. Поддерживает все провайдеры: Groq (бесплатно), Polza, OmniRoute, OpenRouter, HuggingFace, Gemini.</p>
                    <p><strong>Промт:</strong> Используйте <code>{"{{input}}"}</code> для подстановки входных данных. Например: <code>Напиши описание товара: {"{{input}}"}</code></p>
                    <p><strong>Системный промт:</strong> Задаёт роль ИИ. Например: «Ты — копирайтер спортивного магазина».</p>
                    <p><strong>Вход:</strong> text | <strong>Выход:</strong> text</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#6366f1"}}>ИИ: Зрение (Vision)</h4>
                    <p>Анализирует изображение и возвращает JSON с описанием товара (название, категория, атрибуты).</p>
                    <p><strong>Режимы:</strong> full (всё фото), price_tag (ценник), chat (подробный анализ).</p>
                    <p><strong>Вход:</strong> photo | <strong>Выход:</strong> json</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#6366f1"}}>ИИ: Генератор</h4>
                    <p>Полный пайплайн как на странице «Генератор»: сначала Vision анализирует фото, затем текстовая модель создаёт описание по выбранному сценарию.</p>
                    <p><strong>Сценарии:</strong> SEO-описание, краткое, преимущества, сравнение, креативное, e-commerce.</p>
                    <p><strong>Выходы:</strong> text (описание) + json (данные vision)</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#6366f1"}}>ИИ: Эмбеддинг</h4>
                    <p>Создаёт числовой вектор из текста — для семантического поиска или сравнения.</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#6366f1"}}>ИИ: OCR (ценник)</h4>
                    <p>Специализированное распознавание ценников и этикеток. Извлекает название, цену, штрихкод и т.д.</p>
                </div>
            </>
        ),
    },
    catalog: {
        title: "Каталог товаров",
        content: () => (
            <>
                <p className={styles.helpText}>Узлы каталога работают с вашей базой товаров в Supabase (таблица products).</p>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#f97316"}}>Каталог: Поиск</h4>
                    <p>Ищет товары по тексту. Поддерживает семантический поиск (по смыслу, а не точному совпадению).</p>
                    <p><strong>Вход:</strong> текст запроса | <strong>Выход:</strong> массив найденных товаров</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#f97316"}}>Каталог: Вопрос</h4>
                    <p>Задаёт вопрос ИИ о вашем каталоге. Например: «Какие кроссовки дешевле 5000?» — и получает осмысленный ответ.</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#f97316"}}>Каталог: Добавить</h4>
                    <p>Добавляет новый товар в базу. Используйте маппинг полей чтобы указать, какие данные куда записать.</p>
                    <p><strong>Маппинг:</strong> <code>{'{"name":"{{input.name}}","category":"{{input.category}}"}'}</code></p>
                </div>
            </>
        ),
    },
    logic: {
        title: "Логика",
        content: () => (
            <>
                <p className={styles.helpText}>Логические узлы управляют потоком данных: ветвление, объединение, преобразование.</p>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#f59e0b"}}>IF / ELSE</h4>
                    <p>Проверяет условие и направляет данные в одну из двух веток.</p>
                    <p><strong>Операторы:</strong> contains (содержит), equals, not_equals, starts_with, gt (&gt;), lt (&lt;)</p>
                    <p><strong>Пример:</strong> Поле = category, Оператор = contains, Значение = кроссовк → если категория содержит «кроссовк», данные идут в выход <code>true</code>, иначе — <code>false</code>.</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#f59e0b"}}>Маршрутизатор</h4>
                    <p>Как IF/ELSE, но с 3 выходами. Третий маршрут — «всё остальное».</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#f59e0b"}}>Объединить (Merge)</h4>
                    <p>Собирает данные из нескольких веток в один объект. Укажите имена ключей через запятую.</p>
                    <p><strong>3 входа:</strong> a, b, c | <strong>Выход:</strong> merged (объект)</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#f59e0b"}}>Трансформация</h4>
                    <p>Извлекает поле из объекта (dot-notation) или формирует строку по шаблону.</p>
                    <p><strong>Пример извлечения:</strong> <code>data.items.0.name</code></p>
                </div>
            </>
        ),
    },
    data: {
        title: "Данные / База",
        content: () => (
            <>
                <p className={styles.helpText}>Узлы для работы с данными: парсинг, шаблоны, чтение и запись в Supabase.</p>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#06b6d4"}}>JSON Парсер</h4>
                    <p>Парсит строку в JSON-объект. Может извлечь конкретное поле.</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#06b6d4"}}>Шаблон текста</h4>
                    <p>Формирует текст из шаблона: <code>Товар: {"{{input.name}}"}, Цена: {"{{input.price}}"} руб.</code></p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#06b6d4"}}>Supabase: Вставка</h4>
                    <p>INSERT в любую таблицу Supabase. Используйте маппинг полей для указания структуры.</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#06b6d4"}}>Supabase: Запрос</h4>
                    <p>SELECT из таблицы. Можно указать фильтр (поле=значение), лимит и нужные поля.</p>
                </div>
            </>
        ),
    },
    integrations: {
        title: "Интеграции",
        content: () => (
            <>
                <p className={styles.helpText}>Отправка результатов во внешние сервисы. API-ключи и webhook URL задаются в Настройки → Интеграции.</p>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#3b82f6"}}>Telegram</h4>
                    <p>Отправляет сообщение в чат/канал. Требуется Bot Token (через @BotFather) и Chat ID. Поддерживает HTML и Markdown.</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#3b82f6"}}>HTTP Запрос</h4>
                    <p>Универсальный узел для вызова любого REST API. Задайте URL, метод, заголовки и тело запроса.</p>
                    <p>Поддерживает шаблоны в URL, заголовках и body: <code>{"{{input.name}}"}</code></p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#3b82f6"}}>Discord / Slack</h4>
                    <p>Отправка через Incoming Webhook. Создайте вебхук в настройках канала и вставьте URL.</p>
                </div>
                <div className={styles.helpNode}>
                    <h4 style={{color:"#3b82f6"}}>Email (SMTP)</h4>
                    <p>Отправка email. Настройте SMTP в Настройки → Интеграции (Gmail, Yandex, или любой SMTP-сервис).</p>
                </div>
            </>
        ),
    },
    connections: {
        title: "Как соединять узлы",
        content: () => (
            <>
                <p className={styles.helpText}>Каждый узел имеет <strong>входы</strong> (слева) и <strong>выходы</strong> (справа) — цветные кружки на краях.</p>
                <h3 className={styles.helpH3}>Как подключить</h3>
                <ol className={styles.helpList}>
                    <li>Наведите на выходной порт (кружок справа) — курсор станет «+»</li>
                    <li>Зажмите и тяните стрелку до входного порта другого узла</li>
                    <li>Отпустите — соединение создано!</li>
                </ol>
                <h3 className={styles.helpH3}>Типы портов</h3>
                <ul className={styles.helpList}>
                    <li><code>photo</code> — изображение (base64)</li>
                    <li><code>text</code> — текстовая строка</li>
                    <li><code>json</code> — JSON-объект (данные товара, анализа и т.д.)</li>
                    <li><code>data</code> — любые данные</li>
                    <li><code>true / false</code> — ветки IF/ELSE</li>
                    <li><code>route_1, route_2, route_3</code> — ветки маршрутизатора</li>
                </ul>
                <h3 className={styles.helpH3}>Шаблоны данных</h3>
                <p className={styles.helpText}>
                    Во многих полях используются шаблоны: <code>{"{{input}}"}</code> — все входные данные,
                    <code>{"{{input.name}}"}</code> — конкретное поле. Вложенность: <code>{"{{input.data.items.0}}"}</code>.
                </p>
            </>
        ),
    },
    execution: {
        title: "Выполнение потока",
        content: () => (
            <>
                <p className={styles.helpText}>При нажатии «Запустить» поток выполняется на сервере.</p>
                <h3 className={styles.helpH3}>Как это работает</h3>
                <ol className={styles.helpList}>
                    <li>Система находит все узлы-триггеры (без входов) и начинает с них</li>
                    <li>Каждый узел выполняется, его результат передаётся по стрелкам следующим узлам</li>
                    <li>IF/ELSE и маршрутизаторы направляют данные только в нужную ветку</li>
                    <li>По завершении справа появится панель «Результат» с выводом каждого шага</li>
                </ol>
                <h3 className={styles.helpH3}>Отладка</h3>
                <ul className={styles.helpList}>
                    <li>Каждый шаг показывает <span style={{color:"#10b981"}}>✓</span> или <span style={{color:"#ef4444"}}>✗</span></li>
                    <li>Нажмите на шаг чтобы увидеть его вывод (до 400 символов)</li>
                    <li>При ошибке текст ошибки подскажет, что пошло не так</li>
                </ul>
                <h3 className={styles.helpH3}>Тестовое фото</h3>
                <p className={styles.helpText}>Если поток начинается с «Загрузка фото», загрузите изображение через секцию «Тест: фото» в левой панели перед запуском.</p>
            </>
        ),
    },
    tips: {
        title: "Советы и примеры",
        content: () => (
            <>
                <h3 className={styles.helpH3}>Пример: Автокарточка товара</h3>
                <p className={styles.helpText}>
                    Фото → Gemini Vision (анализ) → IF/ELSE (категория = кроссовки?) →
                    Groq (текст для спорта / для блога) → Supabase (сохранить) → Telegram (уведомление).
                </p>
                <p className={styles.helpText}>Нажмите «Демо» в верхней панели чтобы загрузить этот пример.</p>

                <h3 className={styles.helpH3}>Пример: Мониторинг цен</h3>
                <p className={styles.helpText}>
                    Webhook (получить данные) → Каталог: Поиск (найти товар) → IF/ELSE (цена изменилась?) →
                    Supabase (обновить цену) → Telegram (уведомить менеджера).
                </p>

                <h3 className={styles.helpH3}>Пример: Массовая генерация</h3>
                <p className={styles.helpText}>
                    Ручной запуск (JSON с данными) → ИИ: Текст (Groq бесплатно, SEO описание) →
                    Шаблон текста (форматирование) → HTTP запрос (отправить на маркетплейс).
                </p>

                <h3 className={styles.helpH3}>Полезные советы</h3>
                <ul className={styles.helpList}>
                    <li><strong>Groq — бесплатные модели.</strong> Для тестирования используйте llama3 через Groq.</li>
                    <li><strong>Gemini Vision — лучший бесплатный Vision.</strong> Отлично подходит для анализа фото товаров.</li>
                    <li><strong>Сохраняйте чаще.</strong> Потоки хранятся в Supabase и доступны с любого устройства.</li>
                    <li><strong>JSON Парсер.</strong> Если ИИ вернул текст с JSON внутри, парсер его извлечёт.</li>
                    <li><strong>Delete на клавиатуре</strong> удаляет выделенный узел или стрелку.</li>
                </ul>
            </>
        ),
    },
};

function HelpModal({ page, setPage, onClose }) {
    const helpData = HELP_PAGES[page] || HELP_PAGES.main;
    const Content = helpData.content;

    return (
        <div className={styles.helpOverlay} onClick={onClose}>
            <div className={styles.helpModal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.helpHeader}>
                    {page !== "main" && (
                        <button className={styles.helpBackBtn} onClick={() => setPage("main")}>
                            <ChevronLeft size={14} /> Назад
                        </button>
                    )}
                    <span className={styles.helpTitle}>
                        <BookOpen size={16} /> {helpData.title}
                    </span>
                    <button className={styles.configCloseBtn} onClick={onClose}><X size={16} /></button>
                </div>
                <div className={styles.helpBody}>
                    <Content />
                    {helpData.links && (
                        <div className={styles.helpLinks}>
                            {helpData.links.map((link) => (
                                <button key={link.page} className={styles.helpLinkBtn} onClick={() => setPage(link.page)}>
                                    <div className={styles.helpLinkTitle}>{link.label}</div>
                                    <div className={styles.helpLinkDesc}>{link.desc}</div>
                                    <ChevronRight size={14} className={styles.helpLinkArrow} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
