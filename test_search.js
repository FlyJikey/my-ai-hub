const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
    const envPath = path.join(process.cwd(), '.env.local');

    if (!fs.existsSync(envPath)) {
        return;
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) {
            return;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim().replace(/(^"|"$|^'|'$)/g, '');

        if (key && !process.env[key]) {
            process.env[key] = value;
        }
    });
}

loadEnvFile();

async function testSearch(query) {
    console.log("Testing search for query:", query);
    
    const polzaKey = process.env.POLZA_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!polzaKey || !supabaseUrl || !supabaseKey) {
        console.error("Missing keys");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("1. Generating embedding...");
    const embedRes = await fetch("https://polza.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${polzaKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "text-embedding-3-small",
            input: [query]
        })
    });

    if (!embedRes.ok) {
        const err = await embedRes.text();
        console.error("Embedding API Error:", embedRes.status, err);
        return;
    }

    const embedData = await embedRes.json();
    const queryEmbedding = embedData.data[0].embedding;
    console.log("Embedding generated successfully. Length:", queryEmbedding.length);

    console.log("2. Calling Supabase RPC 'match_products'...");
    const { data: products, error: rpcError } = await supabase.rpc('match_products', {
        query_embedding: queryEmbedding,
        match_count: 10,
        match_offset: 0
    });

    if (rpcError) {
        console.error("Supabase RPC Error:", rpcError);
        return;
    }

    console.log("Success! Found products:", products?.length);
    if(products?.length > 0) {
        console.log("First product:", products[0].name);
    }
}

testSearch("найди сколько кабелей питания");
