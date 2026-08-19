
async function test() {
    const payload = {
        lat: 31.3,
        lng: 120.6,
        capacity: 100,
        moduleType: 'standard',
        installationType: 'roof',
        province: '江苏',
        selfUseRatio: 30,
        electricityPrice: 0.65,
        feedInTariff: 0.45
    };

    console.log('Testing calculation payload...');
    try {
        const res = await fetch('http://localhost:3000/api/calculator/solar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

test();
