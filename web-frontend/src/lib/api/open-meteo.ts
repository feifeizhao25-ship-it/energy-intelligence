// Open-Meteo API 封装 (完全免费)
import { WeatherData, PVForecast } from '@/types';

import { withCache } from '@/lib/cache';

/**
 * 获取天气预报（包含100m高度风速）
 */
export const getWeatherForecast = withCache('meteo:forecast', async (lat: number, lng: number, days: number = 7) => {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_100m,wind_direction_100m',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
      timezone: 'Asia/Shanghai',
      forecast_days: days.toString()
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API请求失败: ${response.status}`);
    }

    const data = await response.json();

    return {
      hourly: data.hourly?.time.map((time: string, index: number) => ({
        datetime: time,
        temp: data.hourly.temperature_2m[index],
        humidity: data.hourly.relative_humidity_2m[index],
        feelsLike: data.hourly.apparent_temperature[index],
        precipitation: data.hourly.precipitation[index],
        weatherCode: data.hourly.weather_code[index],
        windSpeed100m: data.hourly.wind_speed_100m[index],
        windDirection100m: data.hourly.wind_direction_100m[index]
      })) || [],
      daily: data.daily?.time.map((time: string, index: number) => ({
        date: time,
        tempMax: data.daily.temperature_2m_max[index],
        tempMin: data.daily.temperature_2m_min[index],
        precipitation: data.daily.precipitation_sum[index],
        weatherCode: data.daily.weather_code[index]
      })) || []
    };

  } catch (error) {
    console.error('获取Open-Meteo天气数据失败:', error);
    throw new Error('获取天气数据失败，请稍后重试');
  }
});

/**
 * 获取太阳位置信息
 */
export const getSunTimes = withCache('meteo:sun', async (lat: number, lng: number, date: Date) => {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      date: date.toISOString().split('T')[0],
      timezone: 'Asia/Shanghai'
    });

    const url = `https://api.open-meteo.com/v1/sunrise-sunset?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo太阳时间API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const daily = data.daily?.[0];

    return {
      sunrise: daily?.sunrise || null,
      sunset: daily?.sunset || null,
      solarNoon: daily?.solar_noon || null,
      dayLength: daily?.day_length || null
    };

  } catch (error) {
    console.error('获取太阳时间失败:', error);
    throw new Error('获取太阳时间失败，请稍后重试');
  }
});

/**
 * 获取光伏发电预测（Open-Meteo Solar API）
 */
export const getPVForecast = withCache('meteo:pv', async (
  lat: number,
  lng: number,
  capacity: number,
  tilt: number = 30,
  azimuth: number = 180
): Promise<PVForecast[]> => {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      hourly: 'temperature_2m,direct_normal_irradiance,diffuse_radiation',
      daily: 'sunrise,sunset,daylight_duration',
      timezone: 'Asia/Shanghai',
      forecast_days: '7',
      system_installation: 'fixed',
      system_incline: tilt.toString(),
      system_azimuth: azimuth.toString(),
      system_capacity: capacity.toString()
    });

    const url = `https://api.open-meteo.com/v1/solar-power?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo Solar API请求失败: ${response.status}`);
    }

    const data = await response.json();

    return data.hourly?.time.map((time: string, index: number) => ({
      date: time,
      watts: Math.round(data.hourly.power_production[index] || 0),
      wattHours: Math.round(data.hourly.energy_production[index] || 0),
      confidence: 0.85 // Open-Meteo预测置信度较高
    })) || [];

  } catch (error) {
    console.error('获取光伏预测失败:', error);
    throw new Error('获取光伏预测失败，请稍后重试');
  }
});

/**
 * 获取碳排放强度
 */
export const getCarbonIntensity = withCache('meteo:carbon', async (country: string = 'CN') => {
  try {
    const params = new URLSearchParams({
      country: country,
      zone: 'Asia/Shanghai'
    });

    const url = `https://api.open-meteo.com/v1/carbon-intensity?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`碳排放强度API请求失败: ${response.status}`);
    }

    const data = await response.json();

    return {
      country: data.country,
      zone: data.zone,
      intensity: data.carbon_intensity || 550, // gCO2/kWh，中国电网平均
      unit: 'gCO2/kWh',
      updatedAt: data.updated_at
    };

  } catch (error) {
    console.error('获取碳排放强度失败:', error);
    throw new Error('获取碳排放强度失败，请稍后重试');
  }
});

/**
 * 获取大气质量指数
 */
export const getAirQualityIndex = withCache('meteo:aq', async (lat: number, lng: number) => {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      hourly: 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
      timezone: 'Asia/Shanghai'
    });

    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`空气质量API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const latest = data.hourly?.time?.length - 1;

    return {
      pm10: data.hourly.pm10[latest],
      pm25: data.hourly.pm2_5[latest],
      carbonMonoxide: data.hourly.carbon_monoxide[latest],
      nitrogenDioxide: data.hourly.nitrogen_dioxide[latest],
      sulphurDioxide: data.hourly.sulphur_dioxide[latest],
      ozone: data.hourly.ozone[latest],
      updatedAt: data.hourly.time[latest]
    };

  } catch (error) {
    console.error('获取空气质量失败:', error);
    throw new Error('获取空气质量失败，请稍后重试');
  }
});

/**
 * 简化版的天气描述映射
 */
export const getWeatherDescription = (code: number): string => {
  const weatherCodes: Record<number, string> = {
    0: '晴朗',
    1: '多云转晴',
    2: '部分多云',
    3: '阴天',
    45: '雾',
    48: '霜雾',
    51: '毛毛雨',
    53: '中雨',
    55: '大雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    95: '雷暴',
    96: '雷暴伴冰雹',
    99: '强雷暴伴冰雹'
  };

  return weatherCodes[code] || '未知';
};

/**
 * 计算100m高度风速（基于Open-Meteo的预测）
 */
export const calculateWindSpeedAtHeight = (
  windSpeed10m: number,
  targetHeight: number = 100
): number => {
  // 使用对数律模型
  const alpha = 0.14; // 粗糙度参数
  const h0 = 10; // 参考高度
  return windSpeed10m * Math.pow(targetHeight / h0, alpha);
};
