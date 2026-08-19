
const lat = 31.3;
const lng = 120.6;
const monthlyUrl = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF,T2M&community=RE&start=2022&end=2022&latitude=${lat}&longitude=${lng}&time-standard=UTC&format=JSON`;

console.log('Fetching:', monthlyUrl);
fetch(monthlyUrl)
    .then(res => {
        console.log('Status:', res.status);
        return res.json();
    })
    .then(data => {
        console.log('Data keys:', Object.keys(data));
        console.log('Sample data:', data.properties.parameter.ALLSKY_SFC_SW_DWN);
    })
    .catch(err => {
        console.error('Error:', err);
    });
