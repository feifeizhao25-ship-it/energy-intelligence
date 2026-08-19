
import { executeTool } from '@/lib/ai/tool-executor';

async function runTests() {
    console.log('--- Starting Integration Tests ---');

    // Test 1: NREL Solar (Expect Fallback)
    console.log('\nTest 1: NREL Solar Resource (Fallback)');
    try {
        const result = await executeTool('get_nrel_solar_resource', {
            lat: 31.23,
            lng: 121.47,
            capacity: 10
        });
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Test 1 Failed:', error);
    }

    // Test 2: Air Quality (Expect OpenMeteo Fallback)
    console.log('\nTest 2: Air Quality (Fallback to OpenMeteo)');
    try {
        const result = await executeTool('get_air_quality', {
            lat: 31.23,
            lng: 121.47
        });
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Test 2 Failed:', error);
    }
}

runTests().catch(console.error);
