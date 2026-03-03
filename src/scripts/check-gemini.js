const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env.local" });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const list = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Placeholder to get the client
        // Actually there is a listModels method on the genAI object
        const models = await genAI.listModels();
        console.log("Available models:");
        console.log(JSON.stringify(models, null, 2));
    } catch (err) {
        console.error("Error listing models:", err);
    }
}

listModels();
