const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testExport() {
    const baseUrl = 'http://localhost:3000';
    console.log('--- Testing Export API ---');

    try {
        // 1. 请求导出
        console.log('Step 1: Requesting Excel export...');
        const exportResponse = await axios.post(`${baseUrl}/api/exports`, {
            dataType: 'projects',
            format: 'xlsx'
        });

        if (!exportResponse.data.success) {
            throw new Error(`Export request failed: ${exportResponse.data.error}`);
        }

        const { filename, downloadUrl } = exportResponse.data.data;
        console.log(`Success! Filename: ${filename}`);
        console.log(`Download URL: ${downloadUrl}`);

        // 2. 尝试下载
        console.log('\nStep 2: Downloading file...');
        const downloadResponse = await axios.get(`${baseUrl}${downloadUrl}`, {
            responseType: 'arraybuffer'
        });

        const filePath = path.join(__dirname, '..', 'public', filename);
        fs.writeFileSync(filePath, downloadResponse.data);

        console.log(`File downloaded successfully to: ${filePath}`);
        console.log(`File size: ${downloadResponse.data.byteLength} bytes`);

    } catch (error: any) {
        console.error('Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testExport();
