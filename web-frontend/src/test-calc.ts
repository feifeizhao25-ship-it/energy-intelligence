
import { calculateWind } from './lib/calculator/wind';
import { calculateStorage } from './lib/calculator/storage';
import { compareSolarAndWind } from './lib/calculator/solar';

async function runTests() {
    console.log('--- Starting Calculation Tests ---');

    // Test Storage (Sync, no API)
    try {
        console.log('\nTesting calculateStorage...');
        const storageInput = {
            capacity: 1000,
            cycleLife: 6000,
            batteryType: 'lithium_iron' as const,
            lat: 39.9,
            lng: 116.4,
            province: '北京'
        };
        const storageResult = calculateStorage(storageInput);
        console.log('Storage Result:', JSON.stringify(storageResult, null, 2));
    } catch (error) {
        console.error('Storage Calculation Error:', error);
    }

    // Test Wind (Async, API)
    try {
        console.log('\nTesting calculateWind...');
        const windInput = {
            lat: 23.1291, // Guangzhou
            lng: 113.2644,
            capacity: 2000,
            turbineType: 'medium_wind' as const,
            hubHeight: 100,
            turbineCount: 1,
            electricityPrice: 0.5,
            province: '广东'
        };
        const windResult = await calculateWind(windInput);
        console.log('Wind Result:', JSON.stringify(windResult, null, 2));
    } catch (error) {
        console.error('Wind Calculation Error:', error);
    }

    // Test Comparison (Async, API)
    try {
        console.log('\nTesting compareSolarAndWind...');
        const result = await compareSolarAndWind(31.2304, 121.4737, '上海');
        console.log('Comparison Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Comparison Calculation Error:', error);
    }
}

runTests().catch(console.error);
