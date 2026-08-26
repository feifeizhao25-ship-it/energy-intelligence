
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { executeTool } from '@/lib/ai/tool-executor';

async function runTests() {
    console.log('=== Starting Comprehensive Feature Tests ===\n');

    const tests = [
        {
            name: '1. Location: Geocoding (Beijing)',
            tool: 'geocode_address',
            input: { address: '北京大兴国际机场' }
        },
        {
            name: '2. Location: Reverse Geocoding',
            tool: 'reverse_geocode',
            input: { lat: 39.509, lng: 116.413 }
        },
        {
            name: '3. Location: Nearby POIs (Substations)',
            tool: 'search_nearby_pois',
            input: { lat: 39.509, lng: 116.413, keywords: ['变电站'], radius: 3000 }
        },
        {
            name: '4. Resource: NREL Solar Data (Shanghai)',
            tool: 'get_nrel_solar_resource',
            input: { lat: 31.23, lng: 121.47, capacity: 50 }
        },
        {
            name: '5. Resource: Air Quality (Shanghai)',
            tool: 'get_air_quality',
            input: { lat: 31.23, lng: 121.47 }
        },
        {
            name: '6. Resource: UV Index (Shanghai)',
            tool: 'get_uv_index',
            input: { lat: 31.23, lng: 121.47 }
        },
        {
            name: '7. Calculator: Solar (100kW)',
            tool: 'calculate_solar',
            input: {
                lat: 31.23, lng: 121.47, capacity: 100,
                installationType: 'roof', moduleType: 'standard',
                selfUseRatio: 0.8, electricityPrice: 0.8, feedInTariff: 0.4,
                province: '上海'
            }
        },
        {
            name: '8. Calculator: Wind (2MW)',
            tool: 'calculate_wind',
            input: {
                lat: 31.23, lng: 121.47, capacity: 2000,
                turbineType: 'medium_wind', hubHeight: 100, turbineCount: 1,
                electricityPrice: 0.45,
                province: '上海'
            }
        },
        {
            name: '9. Calculator: Storage (1MWh)',
            tool: 'calculate_storage',
            input: {
                capacity: 1000, cycleLife: 6000, batteryType: 'lithium_iron',
                lat: 31.23, lng: 121.47, province: '上海'
            }
        },
        {
            name: '10. Calculator: Solar vs Wind Comparison',
            tool: 'compare_solar_wind',
            input: { lat: 31.23, lng: 121.47, province: '上海' }
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        console.log(`\nTesting: ${test.name}...`);
        try {
            const result = await executeTool(test.tool, test.input);
            // Validate result (basic check)
            if (result && typeof result === 'object' && !('error' in result)) {
                console.log('✅ Success');
                // console.log('Preview:', JSON.stringify(result).substring(0, 100) + '...');
            } else {
                console.log('❌ Failed (API returned error)');
                console.error('Error details:', result);
                failed++;
            }
        } catch (error) {
            console.log('❌ Failed (Exception)');
            console.error(error);
            failed++;
        }
        passed++;
    }

    console.log(`\n=== Test Summary ===`);
    console.log(`Total: ${tests.length}`);
    // console.log(`Passed: ${passed}`); // Passed logic above is slightly flawed if I increment passed every time.
    // Actually let's just count failures.
    const successCount = tests.length - failed;
    console.log(`✅ Passed: ${successCount}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed === 0) {
        console.log('\nAll systems operational! 🚀');
    } else {
        console.log('\nSome systems encountered issues. Please check logs.');
    }
}

runTests().catch(console.error);
