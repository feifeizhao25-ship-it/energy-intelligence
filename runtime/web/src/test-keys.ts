import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { executeTool } from '@/lib/ai/tool-executor';
import { geocodeAddress } from '@/lib/api/amap';

async function runTests() {
    console.log('--- Starting Integration Tests with Keys ---');

    // Test 1: NREL Solar (Expect Success or API Response)
    console.log('\nTest 1: NREL Solar Resource');
    try {
        const result = await executeTool('get_nrel_solar_resource', {
            lat: 31.2304,
            lng: 121.4737,
            capacity: 10
        });
        // Check if it's the estimation fallback or actual data
        // Actual data usually has "ac_annual" directly or nested
        console.log('NREL Result:', JSON.stringify(result, null, 2).substring(0, 500) + '...');
    } catch (error) {
        console.error('Test 1 Failed:', error);
    }

    // Test 2: Air Quality (Expect OpenWeatherMap Success)
    console.log('\nTest 2: Air Quality (OpenWeatherMap)');
    try {
        const result = await executeTool('get_air_quality', {
            lat: 31.2304,
            lng: 121.4737
        });
        console.log('AQI Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Test 2 Failed:', error);
    }

    // Test 3: Amap Geocoding
    console.log('\nTest 3: Amap Geocoding');
    try {
        const result = await geocodeAddress('北京市朝阳区天安门');
        console.log('Geocode Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Test 3 Failed:', error);
    }
}

runTests().catch(console.error);
