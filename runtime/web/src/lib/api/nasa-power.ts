// NASA POWER API 封装
import { SolarResource, WindResource } from '@/types';

import { withCache } from '@/lib/cache';

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
  try {
    // 获取月度数据
    const monthlyParams = {
      lat: lat.toFixed(4),
      lon: lng.toFixed(4),
      start: '2022',
      end: '2022',
      parameters: 'ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF,T2M',
      timeStandard: 'UTC',
      outputFormat: 'JSON'
    };

    const monthlyUrl = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${monthlyParams.parameters}&community=RE&start=${monthlyParams.start}&end=${monthlyParams.end}&latitude=${monthlyParams.lat}&longitude=${monthlyParams.lon}&time-standard=${monthlyParams.timeStandard}&format=${monthlyParams.outputFormat}`;

    const response = await fetch(monthlyUrl);
    if (!response.ok) {
      throw new Error(`NASA API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const properties = data.properties;

    // 处理月度数据 (排除 ANN/13月数据)
    const monthlyRaw = Object.entries(properties.parameter.ALLSKY_SFC_SW_DWN).map(([month, ghi]: [string, any]) => {
      let monthNum = parseInt(month);
      if (monthNum > 100) monthNum = monthNum % 100; // Handle YYYYMM format
      return {
        month: monthNum,
        ghi: ghi || 0,
        dni: properties.parameter.ALLSKY_SFC_SW_DNI[month] || 0,
        dhi: properties.parameter.ALLSKY_SFC_SW_DIFF[month] || 0,
        temperature: properties.parameter.T2M[month] || 0
      };
    });

    const monthly = monthlyRaw.filter(m => m.month >= 1 && m.month <= 12).sort((a, b) => a.month - b.month);

    // 计算年度数据
    const annualGhi = monthly.reduce((sum, m) => sum + m.ghi * new Date(2022, m.month, 0).getDate(), 0);
    const annualTemp = monthly.reduce((sum, m) => sum + m.temperature, 0) / 12;

    // 计算峰值日照小时数 (年总辐射量 kWh/m²/year 等效于年峰值小时)
    const peakSunHours = annualGhi;

    // 估算最佳倾角（基于纬度）
    const optimalTilt = Math.abs(lat) + 10;

    // 判断资源等级
    let resourceClass: 'I' | 'II' | 'III' | 'IV' | 'V' = 'III';
    if (annualGhi >= 1800) resourceClass = 'I';
    else if (annualGhi >= 1600) resourceClass = 'II';
    else if (annualGhi >= 1400) resourceClass = 'III';
    else if (annualGhi >= 1200) resourceClass = 'IV';
    else resourceClass = 'V';

    return {
      monthly,
      annual: {
        ghi: annualGhi,
        peakSunHours,
        optimalTilt,
        resourceClass
      }
    };

  } catch (error) {
    console.error('获取太阳能资源数据失败:', error);
    throw new Error('获取太阳能资源数据失败，请稍后重试');
  }
});

/**
 * 获取风能资源数据
 */
export const getWindResource = withCache('nasa:wind', async (lat: number, lng: number): Promise<WindResource> => {
  try {
    const monthlyParams = {
      lat: lat.toFixed(4),
      lon: lng.toFixed(4),
      start: '2022',
      end: '2022',
      parameters: 'WS10M,WS50M',
      timeStandard: 'UTC',
      outputFormat: 'JSON'
    };

    const monthlyUrl = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${monthlyParams.parameters}&community=RE&start=${monthlyParams.start}&end=${monthlyParams.end}&latitude=${monthlyParams.lat}&longitude=${monthlyParams.lon}&time-standard=${monthlyParams.timeStandard}&format=${monthlyParams.outputFormat}`;

    const response = await fetch(monthlyUrl);
    if (!response.ok) {
      throw new Error(`NASA API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const properties = data.properties;

    // 处理月度数据
    const monthly = Object.entries(properties.parameter.WS10M).map(([month, speed10m]: [string, any]) => {
      let monthNum = parseInt(month);
      if (monthNum > 100) monthNum = monthNum % 100;
      const speed50m = speed10m || 0;
      // 使用对数律外推100m风速：v100 = v50 × (100/50)^0.14
      const speed100m = speed50m * Math.pow(100 / 50, 0.14);

      return {
        month: monthNum,
        speed10m: speed10m || 0,
        speed50m,
        speed100m,
        // NASA POWER does not provide direction for this request. Do not invent it.
        direction: null
      };
    }).sort((a, b) => a.month - b.month);

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

  } catch (error) {
    throw new Error('获取风能资源数据失败，请稍后重试');
  }
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
    // NASA POWER 每日数据API
    const start = `${startYear}0101`;
    const end = `${endYear}1231`;

    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${parameters.join(',')}&community=RE&start=${start}&end=${end}&latitude=${lat}&longitude=${lng}&time-standard=UTC&format=JSON`;

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
    const monthlyParams = {
      lat: lat.toFixed(4),
      lon: lng.toFixed(4),
      start: '2022',
      end: '2022',
      parameters: 'T2M,RH2M,PRECTOTCORR,PS,WS10M', // 气温, 湿度, 降水, 气压, 10m风速
      timeStandard: 'UTC',
      outputFormat: 'JSON'
    };

    const monthlyUrl = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${monthlyParams.parameters}&community=RE&start=${monthlyParams.start}&end=${monthlyParams.end}&latitude=${monthlyParams.lat}&longitude=${monthlyParams.lon}&time-standard=${monthlyParams.timeStandard}&format=${monthlyParams.outputFormat}`;

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
