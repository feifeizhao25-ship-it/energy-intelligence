import seed from '@/data/domestic-resources.json';

export interface DomesticStation {
    province: string;
    city: string;
    lat: number;
    lng: number;
    ghi_annual: number;
    monthly_daily_ghi: number[];
    monthly_temp: number[];
    monthly_wind_100m: number[];
    provenance: string;
    license_note: string;
}

const stations = (seed.stations || []) as DomesticStation[];
const limit = Number(seed.match_degrees) || 0.85;

export function nearestDomesticStation(lat: number, lng: number): DomesticStation | null {
    let best: DomesticStation | null = null;
    let bestDistance = limit;
    for (const station of stations) {
        const distance = Math.hypot(station.lat - lat, station.lng - lng);
        if (distance <= bestDistance) {
            best = station;
            bestDistance = distance;
        }
    }
    return best;
}

/** NASA 月度 JSON 形状，坐标用请求值，避免 0.001 度核验把邻近城市判成另一地点。 */
export function domesticNasaMonthly(lat: number, lng: number, year: number): string | null {
    const station = nearestDomesticStation(lat, lng);
    if (!station || station.monthly_daily_ghi.length !== 12 || station.monthly_temp.length !== 12) return null;
    const ghi: Record<string, number> = {};
    const temp: Record<string, number> = {};
    station.monthly_daily_ghi.forEach((value, index) => {
        const key = String(year) + String(index + 1).padStart(2, '0');
        ghi[key] = value;
        temp[key] = station.monthly_temp[index];
    });
    return JSON.stringify({
        provenance: station.provenance,
        license_note: station.license_note,
        station: { province: station.province, city: station.city },
        geometry: { coordinates: [lng, lat] },
        parameters: { ALLSKY_SFC_SW_DWN: { units: 'kW-hr/m^2/day' }, T2M: { units: 'C' } },
        header: { fill_value: -999, start: `${year}0101`, end: `${year}1231`, time_standard: 'UTC' },
        properties: { parameter: { ALLSKY_SFC_SW_DWN: ghi, T2M: temp } },
    });
}
