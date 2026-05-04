import test from "node:test";
import assert from "node:assert/strict";

import { readJsonResponse } from "./src/lib/api-response.js";

test("reads json responses", async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
    });

    assert.deepEqual(await readJsonResponse(response), { ok: true });
});

test("turns html responses into a useful error", async () => {
    const response = new Response("<!DOCTYPE html><html><body>Server error</body></html>", {
        status: 500,
        headers: { "content-type": "text/html" },
    });

    await assert.rejects(
        () => readJsonResponse(response),
        /<!DOCTYPE html><html><body>Server error/
    );
});
