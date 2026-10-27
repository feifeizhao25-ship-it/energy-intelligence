// NASA POWER API 封装
import { SolarResource, WindResource } from '@/types';

import { withCache } from '@/lib/cache';
import { extrapolateWindSpeed } from '@/lib/calculator/wind-shear';

/** NASA POWER 用 -999 表示缺测；缺测或非数值一律按 0 处理，不能当真实风速。 */
function validSpeed(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

export interface NASAApiParams {
  lat: number;
  lng: number;
  start?: string; // YYYYMMDD格式
  end?: string; // YYYYMMDD格式
  parameters?: string[]; // 参数列表
}

/**
 * 获取太阳能资源数据
 */
export const getSolarResource = withCache('nasa:solar', async (lat: number, lng: number): Promise<SolarResource> => {
  const { resolveDomesticStation } = await import('@/lib/api/domestic-station');
  const { toSolarResource, verifiedSolar } = await import('@/lib/api/verified-solar');
  if (!resolveDomesticStation(lat, lng)) throw new Error('DOMESTIC_RESOURCE_NOT_LOADED');
  return toSolarResource(await verifiedSolar(lat, lng), lat);
});

const windPayloads = new Map<string, { properties: { parameter: { WS10M: Record<string, number>; WS50M: Record<string, number> } } }>();

/** 测试与国内缓存写入。用户请求路径不访问 NASA。 */
export function seedWindResourcePayload(lat: number, lng: number, data: { properties: { parameter: { WS10M: Record<string, number>; WS50M: Record<string, number> } } }) {
  windPayloads.set(`${lat.toFixed(4)},${lng.toFixed(4)}`, data);
}

export function parseWindPowerPayload(data: { properties: { parameter: { WS10M: Record<string, number>; WS50M: Record<string, number> } } }): WindResource {
    const properties = data.properties;

    // 处理月度数据。50 米风速直接用 NASA POWER 的 WS50M；此前误把 WS10M 当 50 米风速，
    // 再从「50 米」往上外推，轮毂高度风速被系统性低估。
    const ws50 = properties.parameter.WS50M || {};
    const monthly = Object.entries(properties.parameter.WS10M).map(([month, speed10mRaw]: [string, any]) => {
      let monthNum = parseInt(month);
      if (monthNum > 100) monthNum = monthNum % 100;
      const speed10m = validSpeed(speed10mRaw);
      const speed50m = validSpeed(ws50[month]);
      // 100 米风速由 50 米按对数律外推（与 wind.ts 外推到轮毂高度用同一函数）
      const speed100m = extrapolateWindSpeed(speed50m, 50, 100);

      return {
        month: monthNum,
        speed10m,
        speed50m,
        speed100m,
        // NASA POWER does not provide direction for this request. Do not invent it.
        direction: null
      };
    }).filter(m => m.month >= 1 && m.month <= 12).sort((a, b) => a.month - b.month);

    // 计算年度数据
    const avgSpeed10m = monthly.reduce((sum, m) => sum + m.speed10m, 0) / 12;
    const avgSpeed100m = monthly.reduce((sum, m) => sum + m.speed100m, 0) / 12;

    // 简化计算风功率密度 (W/m²)
    // P = 0.5 × ρ × v³，其中ρ为空气密度(1.225 kg/m³)
    const airDensity = 1.225;
    const powerDensity = 0.5 * airDensity * Math.pow(avgSpeed100m, 3);

    // 估算等效满发小时数（简化模型）
    // 假设容量因子与风速的立方成正比
    const equivalentHours = Math.min(8760, Math.max(0, (avgSpeed100m / 10) * 2000));

    // 判断风资源等级
    let resourceClass: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' = 'III';
    if (avgSpeed100m >= 9) resourceClass = 'I';
    else if (avgSpeed100m >= 8) resourceClass = 'II';
    else if (avgSpeed100m >= 7) resourceClass = 'III';
    else if (avgSpeed100m >= 6) resourceClass = 'IV';
    else if (avgSpeed100m >= 5) resourceClass = 'V';
    else if (avgSpeed100m >= 4) resourceClass = 'VI';
    else resourceClass = 'VII';

    return {
      monthly,
      annual: {
        avgSpeed: avgSpeed100m,
        powerDensity,
        equivalentHours,
        resourceClass
      }
    };
}

/**
 * 获取风能资源数据。只读国内缓存；批次导入在后端 nasa_batch_import。
 */
export const getWindResource = withCache('nasa:wind', async (lat: number, lng: number): Promise<WindResource> => {
  const seeded = windPayloads.get(`${lat.toFixed(4)},${lng.toFixed(4)}`);
  if (seeded) return parseWindPowerPayload(seeded);
  const { nearestDomesticStation } = await import('@/lib/api/domestic-station');
  const station = nearestDomesticStation(lat, lng);
  if (!station) throw new Error('DOMESTIC_RESOURCE_NOT_LOADED');
  const months = Object.fromEntries(station.monthly_wind_100m.map((speed, index) => {
    const key = `2022${String(index + 1).padStart(2, '0')}`;
    return [key, speed];
  }));
  const ws50 = Object.fromEntries(Object.entries(months).map(([key, speed]) => [key, Number(speed) * 0.9]));
  return parseWindPowerPayload({ properties: { parameter: { WS10M: ws50, WS50M: months } } });
});

/**
 * 获取历史气象数据（趋势分析用）
 */
export const getHistoricalData = withCache('nasa:history', async (
  lat: number,
  lng: number,
  startYear: number,
  endYear: number,
  parameters: string[] = ['T2M', 'WS10M', 'ALLSKY_SFC_SW_DWN']
): Promise<any> => {
  try {
    throw new Error('OVERSEAS_SOURCE_DISABLED');
    // 历史序列只从国内缓存读取。
    const start = `${startYear}0101`;
    const end = `${endYear}1231`;

    const url = `https://domestic-cache.invalid/api/temporal/daily/point?parameters=${parameters.join(',')}&community=RE&start=${start}&end=${end}&latitude=${lat}&longitude=${lng}&time-standard=UTC&format=JSON`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NASA历史数据请求失败: ${response.status}`);
    }

    const data = await response.json();
    const properties = data.properties;

    // 处理为年度平均数据用于趋势分析
    const yearlyData: { [year: string]: any } = {};

    // 初始化年度对象
    for (let y = startYear; y <= endYear; y++) {
      yearlyData[y] = { count: 0, ghi: 0, windSpeed: 0, temp: 0 };
    }

    // 聚合每日数据
    Object.entries(properties.parameter.ALLSKY_SFC_SW_DWN || {}).forEach(([date, val]: [string, any]) => {
      const year = date.substring(0, 4);
      if (yearlyData[year] && val > -90) { // -999 is missing data
        yearlyData[year].count++;
        yearlyData[year].ghi += val;
        yearlyData[year].windSpeed += properties.parameter.WS10M[date] || 0;
        yearlyData[year].temp += properties.parameter.T2M[date] || 0;
      }
    });

    // 计算平均值
    const trend = Object.entries(yearlyData).map(([year, d]: [string, any]) => {
      const count = d.count || 1;
      return {
        year: parseInt(year),
        ghi: d.ghi / count,
        windSpeed: d.windSpeed / count,
        temperature: d.temp / count
      };
    }).sort((a, b) => a.year - b.year);

    return trend;

  } catch (error) {
    console.error('获取历史数据失败:', error);
    throw new Error('历史气象数据暂时不可用，请稍后重试');
  }
});

/**
 * 获取气候环境数据
 */
export const getClimateData = withCache('nasa:climate', async (lat: number, lng: number): Promise<any> => {
  try {
    throw new Error('OVERSEAS_SOURCE_DISABLED');
    const monthlyParams = {
      lat: lat.toFixed(4),
      lon: lng.toFixed(4),
      start: '2022',
      end: '2022',
      parameters: 'T2M,RH2M,PRECTOTCORR,PS,WS10M', // 气温, 湿度, 降水, 气压, 10m风速
      timeStandard: 'UTC',
      outputFormat: 'JSON'
    };

    const monthlyUrl = `https://domestic-cache.invalid/api/temporal/monthly/point?parameters=${monthlyParams.parameters}&community=RE&start=${monthlyParams.start}&end=${monthlyParams.end}&latitude=${monthlyParams.lat}&longitude=${monthlyParams.lon}&time-standard=${monthlyParams.timeStandard}&format=${monthlyParams.outputFormat}`;

    const response = await fetch(monthlyUrl);
    if (!response.ok) {
      throw new Error(`NASA API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const properties = data.properties;

    // 处理月度数据
    const monthly = Object.keys(properties.parameter.T2M).map((month) => {
      const monthNum = parseInt(month);
      return {
        month: monthNum,
        temperature: properties.parameter.T2M[month] || 0,
        humidity: properties.parameter.RH2M[month] || 0,
        precipitation: properties.parameter.PRECTOTCORR[month] || 0,
        pressure: properties.parameter.PS[month] || 0,
        windSpeed: properties.parameter.WS10M[month] || 0
      };
    }).sort((a, b) => a.month - b.month);

    // 计算年度数据
    const annualTemp = monthly.reduce((sum, m) => sum + m.temperature, 0) / 12;
    const annualPrecip = monthly.reduce((sum, m) => sum + m.precipitation, 0); // 总降水
    const annualHumidity = monthly.reduce((sum, m) => sum + m.humidity, 0) / 12;

    // 气候特征描述
    let description = '温和';
    if (annualTemp > 25) description = '炎热';
    else if (annualTemp < 0) description = '寒冷';

    return {
      monthly,
      annual: {
        temperature: annualTemp,
        precipitation: annualPrecip,
        humidity: annualHumidity,
        description
      }
    };

  } catch (error) {
    console.error('获取气候数据失败:', error);
    throw new Error('获取气候数据失败，请稍后重试');
  }
});

/**
 * 计算光伏发电指数 (0-100)
 */
export const calculatePVIndex = (weather: {
  clouds: number;
  temperature: number;
  humidity: number;
}): number => {
  // 基于云量、温度、湿度计算光伏发电指数
  const cloudFactor = Math.max(0, 1 - weather.clouds / 100); // 云量影响
  const tempFactor = weather.temperature > 25 ? Math.max(0.6, 1 - (weather.temperature - 25) * 0.02) : 1; // 温度影响
  const humidityFactor = weather.humidity > 80 ? 0.9 : 1; // 湿度影响

  return Math.round(cloudFactor * tempFactor * humidityFactor * 100);
};

/**
 * 计算风电发电指数 (0-100)
 */
export const calculateWindIndex = (weather: {
  windSpeed: number;
}): number => {
  const speed = weather.windSpeed;

  if (speed < 3 || speed > 25) return 0; // 低于切入风速或高于切出风速
  if (speed >= 9 && speed <= 12) return 100; // 额定风速区间

  // 计算在3-25m/s区间内的发电指数
  const normalized = (speed - 3) / (25 - 3);
  return Math.round(Math.max(0, Math.min(100, normalized * 100)));
};
