import test from "node:test";
import assert from "node:assert/strict";

import {
    getAllowedModelIds,
    getDefaultModelId,
    buildTaskModelSummary,
    buildRequestExample,
    buildAiSetupPrompt,
} from "./src/lib/integration-docs.js";

const models = [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "groq" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "polza" },
];

test("uses real model ids when task allows all models", () => {
    const task = { id: "worker", allowedModels: ["all"] };

    assert.deepEqual(getAllowedModelIds(task, models), [
        "llama-3.3-70b-versatile",
        "openai/gpt-4o-mini",
    ]);
    assert.equal(getDefaultModelId(task, models), "llama-3.3-70b-versatile");
});

test("does not invent a fallback model when a task has no allowed models", () => {
    const task = { id: "judge", allowedModels: [] };

    assert.deepEqual(getAllowedModelIds(task, models), []);
    assert.equal(getDefaultModelId(task, models), "");
    assert.equal(buildTaskModelSummary(task, models), "модели не выбраны");
});

test("builds examples from selected task and model facts", () => {
    const task = { id: "judge", allowedModels: ["openai/gpt-4o-mini"] };
    const example = buildRequestExample({
        siteUrl: "https://example.com",
        apiKey: "sk-aihub-real",
        task,
        models,
    });

    assert.match(example, /"task": "judge"/);
    assert.match(example, /"model": "openai\/gpt-4o-mini"/);
    assert.doesNotMatch(example, /llama-3\.3-70b-versatile/);
});

test("builds ai setup prompt from integration facts", () => {
    const prompt = buildAiSetupPrompt({
        siteUrl: "https://example.com",
        apiKey: "sk-aihub-real",
        integration: {
            name: "dashboard",
            tasks: [{ id: "judge", allowedModels: ["openai/gpt-4o-mini"] }],
        },
        models,
    });

    assert.match(prompt, /Endpoint: https:\/\/example\.com\/api\/integrations\/chat/);
    assert.match(prompt, /Authorization: Bearer sk-aihub-real/);
    assert.match(prompt, /Задача: judge/);
    assert.match(prompt, /"model": "openai\/gpt-4o-mini"/);
    assert.doesNotMatch(prompt, /kr\/unknown-model/);
});
