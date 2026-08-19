import { calculateSolar } from './src/lib/calculator/solar';
import { calculateWind } from './src/lib/calculator/wind';
import { calculateStorage } from './src/lib/calculator/storage';

async function testSolar() {
    console.log('--- Testing Solar Calculator ---');
    const input = {
        lat: 31.2304,
        lng: 121.4737,
        province: '上海',
        capacity: 500, // 500kW
        moduleType: 'standard',
        installationType: 'roof',
        tilt: 20,
        azimuth: 180,
        selfUseRatio: 70,
        electricityPrice: 0.9,
        feedInTariff: 0.41,
        unitCost: 3800 // 元/kW
    };

    try {
        const result = await calculateSolar(input as any);
        console.log('Solar Result:', JSON.stringify(result, null, 2));
        console.log('Solar IRR:', result.financial.irr.toFixed(2) + '%');
        console.log('Solar Payback:', result.financial.paybackYears.toFixed(2) + ' years');
    } catch (e) {
        console.error('Solar Test Failed:', e);
    }
}

async function testWind() {
    console.log('\n--- Testing Wind Calculator ---');
    const input = {
        lat: 40.0,
        lng: 110.0,
        province: '河北',
        projectName: 'Test Wind Project',
        turbine: {
            type: 'medium_wind',
            capacity: 2.5,
            count: 2,
            hubHeight: 100,
            rotorDiameter: 150,
            cutInSpeed: 3,
            ratedSpeed: 10,
            cutOutSpeed: 25
        },
        businessModel: {
            mode: 'full_export',
            feedInTariff: 0.38
        },
        investment: { unitCost: 6000 },
        operation: {}
    };

    try {
        const result = await calculateWind(input as any);
        console.log('Wind Result:', JSON.stringify(result, null, 2));
        console.log('Wind IRR:', result.financial.irr.toFixed(2) + '%');
    } catch (e) {
        console.error('Wind Test Failed:', e);
    }
}

async function testStorage() {
    console.log('\n--- Testing Storage Calculator ---');
    const input = {
        capacity: 1000,
        energy: 2000,
        location: { province: '广东', lat: 23, lng: 113 },
        applicationMode: 'arbitrage',
        arbitrageConfig: { peakPrice: 1.2, valleyPrice: 0.3, flatPrice: 0.6 },
        investment: { unitCost: 1600, financing: 'cash' },
        technical: { efficiency: 90, dod: 90, cycleLife: 6000, degradationRate: 2, maintenanceCostRatio: 1 }
    };

    try {
        const result = await calculateStorage(input as any);
        console.log('Storage Result:', JSON.stringify(result, null, 2));
        if (result.financial && result.financial.metrics) {
            console.log('Storage IRR:', result.financial.metrics.irr.toFixed(2) + '%');
        }
    } catch (e) {
        console.error('Storage Test Failed:', e);
    }
}

async function runTests() {
    await testSolar();
    await testWind();
    await testStorage();
}

runTests();
