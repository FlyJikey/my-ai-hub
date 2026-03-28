"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Handle,
    Position,
    BackgroundVariant,
    Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    Plus, Save, Play, Trash2, ChevronRight, ChevronDown,
    Upload, Globe, Zap, GitBranch, Database, Code, Send,
    X, Settings, CheckCircle, AlertCircle, RefreshCw, Eye,
    Loader, FileText, MoreHorizontal, Copy, List
} from "lucide-react";
import styles from "./page.module.css";

// ─── Node type definitions ────────────────────────────────────────────────────
const NODE_DEFS = {
    // Triggers
    trigger_photo: {
        label: "Загрузка фото",
        category: "trigger",
        color: "#10b981",
        icon: "Upload",
        inputs: [],
        outputs: ["photo"],
        description: "Триггер при загрузке изображения",
        configFields: [],
    },
    trigger_webhook: {
        label: "Webhook",
        category: "trigger",
        color: "#10b981",
        icon: "Globe",
        inputs: [],
        outputs: ["data"],
        description: "Входящий HTTP webhook",
        configFields: [
            { key: "path", label: "URL путь", type: "text", placeholder: "/webhook/my-flow" },
            { key: "method", label: "HTTP метод", type: "select", options: ["POST", "GET", "PUT"] },
        ],
    },
    // AI Nodes
    ai_gemini_vision: {
        label: "Gemini Vision",
        category: "ai",
        color: "#6366f1",
        icon: "Eye",
        inputs: ["photo"],
        outputs: ["json"],
        description: "Анализирует изображение, возвращает JSON описание",
        configFields: [
            { key: "prompt", label: "Промт", type: "textarea", placeholder: "Опиши товар на фото: название, категорию, цвет, материал..." },
            { key: "language", label: "Язык ответа", type: "select", options: ["ru", "en"] },
        ],
    },
    ai_groq_llama: {
        label: "Groq / Llama 3",
        category: "ai",
        color: "#8b5cf6",
        icon: "Zap",
        inputs: ["text"],
        outputs: ["text"],
        description: "Генерирует текст на основе промта (бесплатно)",
        configFields: [
            { key: "model", label: "Модель", type: "select", options: ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma2-9b-it"] },
            { key: "system_prompt", label: "Системный промт", type: "textarea", placeholder: "Ты — копирайтер для интернет-магазина..." },
            { key: "user_template", label: "Шаблон сообщения", type: "textarea", placeholder: "Напиши карточку товара для: {{input}}" },
            { key: "temperature", label: "Temperature (0–1)", type: "number", placeholder: "0.7" },
        ],
    },
    // Logic
    logic_ifelse: {
        label: "IF / ELSE",
        category: "logic",
        color: "#f59e0b",
        icon: "GitBranch",
        inputs: ["input"],
        outputs: ["true", "false"],
        description: "Условный переход на основе значения поля",
        configFields: [
            { key: "field", label: "Поле для проверки", type: "text", placeholder: "category" },
            { key: "operator", label: "Оператор", type: "select", options: ["contains", "equals", "not_equals", "starts_with"] },
            { key: "value", label: "Значение", type: "text", placeholder: "кроссовки" },
        ],
    },
    logic_router: {
        label: "Маршрутизатор",
        category: "logic",
        color: "#f59e0b",
        icon: "GitBranch",
        inputs: ["input"],
        outputs: ["route_1", "route_2", "route_3"],
        description: "Разветвляет поток по значению поля",
        configFields: [
            { key: "field", label: "Поле для роутинга", type: "text", placeholder: "category" },
            { key: "route_1_value", label: "Маршрут 1: значение", type: "text", placeholder: "обувь" },
            { key: "route_2_value", label: "Маршрут 2: значение", type: "text", placeholder: "одежда" },
            { key: "route_3_value", label: "Маршрут 3: значение", type: "text", placeholder: "*" },
        ],
    },
    // Data & Integrations
    data_supabase: {
        label: "Supabase Insert",
        category: "data",
        color: "#06b6d4",
        icon: "Database",
        inputs: ["data"],
        outputs: ["result"],
        description: "Вставляет данные в таблицу Supabase",
        configFields: [
            { key: "table", label: "Таблица", type: "text", placeholder: "products" },
            { key: "mapping", label: "Маппинг полей (JSON)", type: "textarea", placeholder: '{"name": "{{input.name}}", "category": "{{input.category}}"}' },
        ],
    },
    data_json_parser: {
        label: "JSON Парсер",
        category: "data",
        color: "#06b6d4",
        icon: "Code",
        inputs: ["text"],
        outputs: ["json"],
        description: "Извлекает JSON из текста или преобразует данные",
        configFields: [
            { key: "extract_field", label: "Извлечь поле (опционально)", type: "text", placeholder: "data.items[0]" },
        ],
    },
    data_telegram: {
        label: "Telegram Send",
        category: "data",
        color: "#06b6d4",
        icon: "Send",
        inputs: ["data"],
        outputs: [],
        description: "Отправляет сообщение в Telegram (токен из Настроек)",
        configFields: [
            { key: "chat_id", label: "Chat ID", type: "text", placeholder: "-1001234567890" },
            { key: "template", label: "Шаблон сообщения", type: "textarea", placeholder: "Новый товар: {{input.name}}\nКатегория: {{input.category}}" },
        ],
    },
};

const CATEGORIES = [
    { key: "trigger", label: "Триггеры", color: "#10b981" },
    { key: "ai", label: "ИИ Узлы", color: "#6366f1" },
    { key: "logic", label: "Логика", color: "#f59e0b" },
    { key: "data", label: "Данные / Интеграции", color: "#06b6d4" },
];

const ICON_MAP = { Upload, Globe, Eye, Zap, GitBranch, Database, Code, Send };

// ─── Custom Node Component ─────────────────────────────────────────────────────
function FlowNode({ data, selected }) {
    const def = NODE_DEFS[data.nodeType] || {};
    const IconComp = ICON_MAP[def.icon] || Zap;
    const color = def.color || "#6366f1";

    return (
        <div className={`${styles.flowNode} ${selected ? styles.flowNodeSelected : ""}`}
            style={{ "--node-color": color }}>

            {/* Input handles */}
            {(def.inputs || []).map((port, i) => (
                <Handle
                    key={`in-${port}`}
                    type="target"
                    position={Position.Left}
                    id={port}
                    style={{ top: `${((i + 1) / ((def.inputs.length || 1) + 1)) * 100}%`, background: color }}
                    title={port}
                />
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
                    {Object.entries(data.config).slice(0, 2).map(([k, v]) => (
                        v ? <div key={k} className={styles.flowNodeConfigPreview}>
                            <span className={styles.flowNodeConfigKey}>{k}:</span>
                            <span className={styles.flowNodeConfigVal}>{String(v).slice(0, 30)}{String(v).length > 30 ? "…" : ""}</span>
                        </div> : null
                    ))}
                </div>
            )}

            {/* Output handles */}
            {(def.outputs || []).map((port, i) => (
                <Handle
                    key={`out-${port}`}
                    type="source"
                    position={Position.Right}
                    id={port}
                    style={{ top: `${((i + 1) / ((def.outputs.length || 1) + 1)) * 100}%`, background: color }}
                    title={port}
                />
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
    const [openCategories, setOpenCategories] = useState({ trigger: true, ai: true, logic: false, data: false });
    const [flows, setFlows] = useState([]);
    const [currentFlowId, setCurrentFlowId] = useState(null);
    const [currentFlowName, setCurrentFlowName] = useState("Новый поток");
    const [showFlowList, setShowFlowList] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [execResult, setExecResult] = useState(null);
    const [message, setMessage] = useState({ text: "", type: "" });
    const [uploadedPhoto, setUploadedPhoto] = useState(null);
    const reactFlowWrapper = useRef(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const nodeIdCounter = useRef(1);

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

    // ── Drag-n-drop from panel ──
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
        const id = `node_${Date.now()}_${nodeIdCounter.current++}`;
        const newNode = {
            id,
            type: "flowNode",
            position,
            data: { nodeType: type, label: def.label, config: {} },
        };
        setNodes((nds) => nds.concat(newNode));
    }, [reactFlowInstance, setNodes]);

    const onConnect = useCallback((params) => {
        setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#6366f1" } }, eds));
    }, [setEdges]);

    const onNodeClick = useCallback((_, node) => {
        setSelectedNode(node);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    // ── Config panel update ──
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

    // ── Save / Load ──
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
            } else {
                showMsg("Ошибка сохранения", "error");
            }
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
        setNodes([]);
        setEdges([]);
        setSelectedNode(null);
        setExecResult(null);
        setShowFlowList(false);
    };

    // ── Execute ──
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
            if (d.success) showMsg("Поток выполнен успешно!");
            else showMsg(d.error || "Ошибка выполнения", "error");
        } catch (e) { showMsg("Ошибка выполнения: " + e.message, "error"); }
        finally { setIsExecuting(false); }
    };

    // ── Load demo ──
    const loadDemo = () => {
        const demo = {
            name: "Пример: Карточка товара",
            nodes: [
                { id: "n1", type: "flowNode", position: { x: 50, y: 150 }, data: { nodeType: "trigger_photo", label: "Загрузка фото", config: {} } },
                { id: "n2", type: "flowNode", position: { x: 300, y: 150 }, data: { nodeType: "ai_gemini_vision", label: "Gemini Vision", config: { prompt: "Опиши товар на фото: название, категорию, цвет, бренд, материал. Ответь в JSON.", language: "ru" } } },
                { id: "n3", type: "flowNode", position: { x: 550, y: 150 }, data: { nodeType: "logic_ifelse", label: "Это кроссовки?", config: { field: "category", operator: "contains", value: "кроссовк" } } },
                { id: "n4", type: "flowNode", position: { x: 800, y: 50 }, data: { nodeType: "ai_groq_llama", label: "Карточка SPORT", config: { model: "llama3-70b-8192", system_prompt: "Ты — копирайтер спортивного магазина.", user_template: "Напиши продающую карточку для: {{input}}" } } },
                { id: "n5", type: "flowNode", position: { x: 800, y: 280 }, data: { nodeType: "ai_groq_llama", label: "Карточка BLOG", config: { model: "llama3-8b-8192", system_prompt: "Ты — блогер о моде и стиле.", user_template: "Напиши пост для блога о товаре: {{input}}" } } },
                { id: "n6", type: "flowNode", position: { x: 1050, y: 150 }, data: { nodeType: "data_supabase", label: "Сохранить в БД", config: { table: "products", mapping: '{"name":"{{input.name}}","description":"{{input}}"}' } } },
            ],
            edges: [
                { id: "e1", source: "n1", sourceHandle: "photo", target: "n2", targetHandle: "photo", animated: true, style: { stroke: "#6366f1" } },
                { id: "e2", source: "n2", sourceHandle: "json", target: "n3", targetHandle: "input", animated: true, style: { stroke: "#6366f1" } },
                { id: "e3", source: "n3", sourceHandle: "true", target: "n4", targetHandle: "text", animated: true, style: { stroke: "#10b981" } },
                { id: "e4", source: "n3", sourceHandle: "false", target: "n5", targetHandle: "text", animated: true, style: { stroke: "#ef4444" } },
                { id: "e5", source: "n4", sourceHandle: "text", target: "n6", targetHandle: "data", animated: true, style: { stroke: "#6366f1" } },
                { id: "e6", source: "n5", sourceHandle: "text", target: "n6", targetHandle: "data", animated: true, style: { stroke: "#6366f1" } },
            ],
        };
        setCurrentFlowId(null);
        setCurrentFlowName(demo.name);
        setNodes(demo.nodes);
        setEdges(demo.edges);
        setSelectedNode(null);
        showMsg("Демо-поток загружен!");
    };

    const def = selectedNode ? NODE_DEFS[selectedNode.data.nodeType] : null;

    return (
        <div className={styles.page}>
            {/* ── Top Bar ── */}
            <div className={styles.topBar}>
                <div className={styles.topBarLeft}>
                    <input
                        className={styles.flowNameInput}
                        value={currentFlowName}
                        onChange={(e) => setCurrentFlowName(e.target.value)}
                    />
                    <button className={styles.btnOutline} onClick={() => setShowFlowList(!showFlowList)}>
                        <List size={14} /> Потоки {showFlowList ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
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

            {/* ── Flow list dropdown ── */}
            {showFlowList && (
                <div className={styles.flowListDropdown}>
                    {flows.length === 0 ? (
                        <div className={styles.flowListEmpty}>Нет сохранённых потоков</div>
                    ) : flows.map((f) => (
                        <div key={f.id} className={styles.flowListItem} onClick={() => loadFlow(f)}>
                            <span>{f.name}</span>
                            <span className={styles.flowListDate}>{new Date(f.updated_at || f.created_at).toLocaleDateString("ru")}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.editorArea}>
                {/* ── Left Panel: Node Library ── */}
                <div className={styles.nodePanel}>
                    <div className={styles.nodePanelTitle}>Библиотека узлов</div>
                    {CATEGORIES.map((cat) => (
                        <div key={cat.key} className={styles.nodeCategory}>
                            <button
                                className={styles.nodeCategoryHeader}
                                onClick={() => setOpenCategories((p) => ({ ...p, [cat.key]: !p[cat.key] }))}
                            >
                                <span style={{ color: cat.color }}>{cat.label}</span>
                                {openCategories[cat.key] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                            {openCategories[cat.key] && (
                                <div className={styles.nodeCategoryList}>
                                    {Object.entries(NODE_DEFS)
                                        .filter(([, d]) => d.category === cat.key)
                                        .map(([type, d]) => {
                                            const IconComp = ICON_MAP[d.icon] || Zap;
                                            return (
                                                <div
                                                    key={type}
                                                    className={styles.nodePanelItem}
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, type)}
                                                    style={{ "--item-color": d.color }}
                                                    title={d.description}
                                                >
                                                    <IconComp size={13} style={{ color: d.color, flexShrink: 0 }} />
                                                    <span>{d.label}</span>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Photo upload for test run */}
                    <div className={styles.testPhotoSection}>
                        <div className={styles.nodePanelTitle} style={{ marginTop: 12 }}>Тест: Загрузка фото</div>
                        <label className={styles.photoUploadLabel}>
                            <Upload size={14} />
                            {uploadedPhoto ? uploadedPhoto.name : "Выбрать файл"}
                            <input type="file" accept="image/*" className={styles.hiddenInput}
                                onChange={(e) => setUploadedPhoto(e.target.files[0])} />
                        </label>
                        {uploadedPhoto && (
                            <button className={styles.clearPhotoBtn} onClick={() => setUploadedPhoto(null)}>
                                <X size={12} /> Убрать
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Canvas ── */}
                <div className={styles.canvasWrap} ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onInit={setReactFlowInstance}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        fitView
                        colorMode="dark"
                        deleteKeyCode="Delete"
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background variant={BackgroundVariant.Dots} color="#333" gap={20} size={1} />
                        <Controls />
                        <MiniMap
                            nodeColor={(n) => NODE_DEFS[n.data?.nodeType]?.color || "#6366f1"}
                            style={{ background: "#1a1a2e" }}
                            maskColor="rgba(0,0,0,0.5)"
                        />
                        <Panel position="top-center">
                            {nodes.length === 0 && (
                                <div className={styles.emptyHint}>
                                    Перетащите узлы из левой панели или нажмите «Демо»
                                </div>
                            )}
                        </Panel>
                    </ReactFlow>
                </div>

                {/* ── Right Panel: Node Config ── */}
                {selectedNode && def && (
                    <div className={styles.configPanel}>
                        <div className={styles.configPanelHeader}>
                            <span className={styles.configPanelTitle}>Настройка узла</span>
                            <button className={styles.configCloseBtn} onClick={() => setSelectedNode(null)}>
                                <X size={14} />
                            </button>
                        </div>
                        <div className={styles.configNodeType} style={{ color: def.color }}>
                            {def.label}
                        </div>
                        <p className={styles.configDesc}>{def.description}</p>

                        <div className={styles.configField}>
                            <label className={styles.configLabel}>Название узла</label>
                            <input
                                className={styles.configInput}
                                value={selectedNode.data.label || ""}
                                onChange={(e) => updateNodeLabel(e.target.value)}
                            />
                        </div>

                        {(def.configFields || []).map((field) => (
                            <div key={field.key} className={styles.configField}>
                                <label className={styles.configLabel}>{field.label}</label>
                                {field.type === "textarea" ? (
                                    <textarea
                                        className={styles.configTextarea}
                                        value={selectedNode.data.config?.[field.key] || ""}
                                        onChange={(e) => updateNodeConfig(field.key, e.target.value)}
                                        placeholder={field.placeholder}
                                        rows={4}
                                    />
                                ) : field.type === "select" ? (
                                    <select
                                        className={styles.configSelect}
                                        value={selectedNode.data.config?.[field.key] || ""}
                                        onChange={(e) => updateNodeConfig(field.key, e.target.value)}
                                    >
                                        <option value="">— выбрать —</option>
                                        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        className={styles.configInput}
                                        type={field.type || "text"}
                                        value={selectedNode.data.config?.[field.key] || ""}
                                        onChange={(e) => updateNodeConfig(field.key, e.target.value)}
                                        placeholder={field.placeholder}
                                    />
                                )}
                            </div>
                        ))}

                        <div className={styles.configPortInfo}>
                            {def.inputs.length > 0 && (
                                <div><strong>Входы:</strong> {def.inputs.join(", ")}</div>
                            )}
                            {def.outputs.length > 0 && (
                                <div><strong>Выходы:</strong> {def.outputs.join(", ")}</div>
                            )}
                        </div>

                        <button className={styles.deleteNodeBtn} onClick={deleteSelectedNode}>
                            <Trash2 size={13} /> Удалить узел
                        </button>
                    </div>
                )}

                {/* ── Execution Result Panel ── */}
                {execResult && !selectedNode && (
                    <div className={styles.configPanel}>
                        <div className={styles.configPanelHeader}>
                            <span className={styles.configPanelTitle}>Результат выполнения</span>
                            <button className={styles.configCloseBtn} onClick={() => setExecResult(null)}>
                                <X size={14} />
                            </button>
                        </div>
                        <div className={`${styles.execStatus} ${execResult.success ? styles.execSuccess : styles.execError}`}>
                            {execResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            {execResult.success ? "Успешно" : "Ошибка"}
                        </div>
                        {execResult.steps && execResult.steps.map((step, i) => (
                            <div key={i} className={styles.execStep}>
                                <div className={styles.execStepHeader}>
                                    <span className={styles.execStepName}>{step.label}</span>
                                    <span className={`${styles.execStepStatus} ${step.success ? styles.execStepOk : styles.execStepFail}`}>
                                        {step.success ? "✓" : "✗"}
                                    </span>
                                </div>
                                {step.output && (
                                    <pre className={styles.execStepOutput}>
                                        {typeof step.output === "string" ? step.output.slice(0, 300) : JSON.stringify(step.output, null, 2).slice(0, 300)}
                                        {JSON.stringify(step.output).length > 300 ? "\n…" : ""}
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
