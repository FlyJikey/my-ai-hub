import test from "node:test";
import assert from "node:assert/strict";

import {
    getEnabledTextModels,
    syncAllowedModelsWithAvailable,
} from "./src/lib/model-settings.js";

const defaults = [
    { id: "a", name: "A", provider: "one" },
    { id: "b", name: "B", provider: "one" },
];

test("uses enabled text models from saved settings in saved order", () => {
    const models = getEnabledTextModels({
        textModels: [
            { id: "b", name: "Custom B", enabled: true },
            { id: "a", enabled: false },
            { id: "custom", name: "Custom", provider: "custom", enabled: true },
        ],
    }, defaults);

    assert.deepEqual(models.map(model => model.id), ["b", "custom"]);
    assert.equal(models[0].provider, "one");
    assert.equal(models[0].name, "Custom B");
});

test("falls back to enabled defaults when settings have no text models", () => {
    const models = getEnabledTextModels({}, defaults);

    assert.deepEqual(models.map(model => model.id), ["a", "b"]);
});

test("removes selected model ids that are no longer available", () => {
    assert.deepEqual(
        syncAllowedModelsWithAvailable(["a", "missing", "b"], defaults),
        ["a", "b"]
    );
    assert.deepEqual(syncAllowedModelsWithAvailable(["all"], defaults), ["all"]);
});
