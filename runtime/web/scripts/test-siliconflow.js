
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env logic
let apiKey = '';

// Helper to read key
function getKeyState(file) {
    try {
        const envPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(envPath)) return null;
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/SILICONFLOW_API_KEY=(.*)/);
        if (match) return match[1].trim();
    } catch (e) {
        return null;
    }
    return null;
}

// Try .env.local first (priority)
apiKey = getKeyState('.env.local');

// If not found, try .env
if (!apiKey) {
    apiKey = getKeyState('.env');
}

if (!apiKey) {
    console.error('❌ Error: SILICONFLOW_API_KEY not found in .env or .env.local');
    process.exit(1);
}

// Models to test
const models = [
    'deepseek-ai/DeepSeek-V3',
    'deepseek-ai/DeepSeek-V3.2-Exp',
    'Pro/deepseek-ai/DeepSeek-V3.2-Exp',
    'Pro/zai-org/GLM-4.7',
    'zai-org/GLM-4.6',
    'moonshotai/Kimi-K2-Thinking',
    'Pro/moonshotai/Kimi-K2-Thinking',
    'moonshotai/Kimi-K2-Instruct-0905',
    'Kwaipilot/KAT-Dev',
    'MiniMaxAI/MiniMax-M2',
    'inclusionAI/Ling-1T'
];

console.log(`🚀 Testing ${models.length} SiliconFlow models...`);
console.log(`🔑 API Key found: ${apiKey.slice(0, 8)}...`);

async function testModel(model) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const data = JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Hello!' }],
            max_tokens: 10,
            stream: false
        });

        const options = {
            hostname: 'api.siliconflow.cn',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey} `,
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                const duration = Date.now() - startTime;
                if (res.statusCode === 200) {
                    process.stdout.write(`✅ ${model.padEnd(35)}: OK(${duration}ms) \n`);
                    resolve(true);
                } else {
                    process.stdout.write(`❌ ${model.padEnd(35)}: Failed(${res.statusCode}) \n`);
                    // console.log(body); 
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            process.stdout.write(`❌ ${model.padEnd(35)}: Error(${e.message}) \n`);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

(async () => {
    let successCount = 0;
    for (const model of models) {
        const success = await testModel(model);
        if (success) successCount++;
    }
    console.log(`\n🎉 Test Complete: ${successCount}/${models.length} models valid.`);
})();
