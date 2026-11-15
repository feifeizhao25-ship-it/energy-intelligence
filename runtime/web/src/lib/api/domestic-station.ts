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

export interface ResolvedStation extends DomesticStation {
    interpolated?: boolean;
    station_note?: string;
}

const INTERP_DEGREES = 3.5;

/** 0.85° 内用样本点；更远但落在两个省级城市之间时按距离加权，并标明不是实测。 */
export function resolveDomesticStation(lat: number, lng: number): ResolvedStation | null {
    const near = nearestDomesticStation(lat, lng);
    if (near) return near;
    const ranked = stations
        .map((station) => ({ station, distance: Math.hypot(station.lat - lat, station.lng - lng) }))
        .filter((item) => item.station.monthly_daily_ghi.length === 12 && item.station.monthly_temp.length === 12 && item.station.monthly_wind_100m.length === 12)
        .sort((left, right) => left.distance - right.distance);
    if (ranked.length < 2 || ranked[0].distance > INTERP_DEGREES) return null;
    const pair = ranked.slice(0, 2);
    const weights = pair.map((item) => 1 / (item.distance + 0.05));
    const total = weights[0] + weights[1];
    const mix = (pick: (station: DomesticStation) => number[]) => Array.from({ length: 12 }, (_, index) => (
        weights[0] * pick(pair[0].station)[index] + weights[1] * pick(pair[1].station)[index]
    ) / total);
    const daily = mix((station) => station.monthly_daily_ghi);
    const names = pair.map((item) => `${item.station.province}${item.station.city}`).join('、');
    return {
        province: pair[0].station.province,
        city: '插值',
        lat,
        lng,
        ghi_annual: daily.reduce((sum, value) => sum + value, 0),
        monthly_daily_ghi: daily,
        monthly_temp: mix((station) => station.monthly_temp),
        monthly_wind_100m: mix((station) => station.monthly_wind_100m),
        provenance: '邻近样本插值（不是该坐标实测）',
        license_note: `${seed.license_note} 数值由邻近省级城市样本按距离加权，不是该点实测，也不是 NASA POWER 实测。`,
        interpolated: true,
        station_note: `由 ${names} 插值，请求坐标为 ${lat},${lng}`,
    };
}

/** NASA 月度 JSON 形状，坐标用请求值，避免 0.001 度核验把邻近城市判成另一地点。 */
/** 对比页和报告页用的气候量。降水、湿度没有进入省级样本时保持空，不写成 0。 */
export function domesticClimate(lat: number, lng: number) {
    const station = resolveDomesticStation(lat, lng);
    if (!station) throw new Error('DOMESTIC_RESOURCE_NOT_LOADED');
    const monthly = station.monthly_temp.map((temperature, index) => ({
        month: index + 1,
        temperature,
        humidity: null,
        precipitation: null,
        pressure: null,
        windSpeed: station.monthly_wind_100m[index] ?? null,
    }));
    const temperature = monthly.reduce((sum, month) => sum + month.temperature, 0) / 12;
    return {
        monthly,
        annual: {
            temperature,
            precipitation: null as number | null,
            humidity: null as number | null,
            description: temperature > 25 ? '炎热' : temperature < 0 ? '寒冷' : '温和',
        },
        provenance: station.provenance,
        licenseNote: station.license_note,
        station: { province: station.province, city: station.city, interpolated: Boolean(station.interpolated) },
    };
}

export function domesticNasaMonthly(lat: number, lng: number, year: number): string | null {
    const station = resolveDomesticStation(lat, lng);
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
        station_note: station.station_note || '',
        station: { province: station.province, city: station.city },
        geometry: { coordinates: [lng, lat] },
        parameters: { ALLSKY_SFC_SW_DWN: { units: 'kW-hr/m^2/day' }, T2M: { units: 'C' } },
        header: { fill_value: -999, start: `${year}0101`, end: `${year}1231`, time_standard: 'UTC' },
        properties: { parameter: { ALLSKY_SFC_SW_DWN: ghi, T2M: temp } },
    });
}
