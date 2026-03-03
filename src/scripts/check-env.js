const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envPath)) {
    console.log('.env.local does not exist!');
    process.exit(0);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const keys = [];

envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [key, value] = trimmed.split('=');
        if (value && value.trim()) {
            keys.push({ key: key.trim(), hasValue: true });
        }
    }
});

console.log('--- ENV KEYS CONFIGURED ---');
console.table(keys);
