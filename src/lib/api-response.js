export async function readJsonResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return response.json();
    }

    const text = await response.text();
    const firstLine = text.replace(/\s+/g, " ").trim().slice(0, 160);
    throw new Error(firstLine || `HTTP ${response.status}`);
}
