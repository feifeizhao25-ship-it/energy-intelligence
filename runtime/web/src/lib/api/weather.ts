// OpenWeatherMap API 封装
import { WeatherData } from '@/types';

// 简单的内存缓存
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10分钟

// 缓存装饰器
function withCache<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: any[]) => {
    const key = `${fn.name}:${JSON.stringify(args)}`;
    const cached = cache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const result = await fn(...args);
    cache.set(key, { data: result, expires: Date.now() + CACHE_DURATION });
    return result;
  }) as T;
}

/**
 * 获取实时天气数据
 */
export const getCurrentWeather = withCache(async (lat: number, lng: number): Promise<WeatherData> => {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      throw new Error('OpenWeatherMap API Key未配置');
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=zh_cn`;

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('OpenWeatherMap API Key无效');
      } else if (response.status === 429) {
        throw new Error('OpenWeatherMap API调用频率超限');
      } else {
        throw new Error(`OpenWeatherMap API请求失败: ${response.status}`);
      }
    }

    const data = await response.json();

    return {
      temp: Math.round(data.main.temp * 10) / 10,
      humidity: Math.round(data.main.humidity),
      windSpeed: Math.round(data.wind?.speed * 10) / 10,
      windDirection: data.wind?.deg || 0,
      clouds: data.clouds?.all || 0,
      description: data.weather[0]?.description || '未知',
      icon: data.weather[0]?.icon || '01d',
      pressure: data.main?.pressure || 1013,
      visibility: data.visibility || 10000,
      uvIndex: 0 // OpenWeatherMap免费版不提供UV指数
    };

  } catch (error) {
    console.error('获取天气数据失败:', error);
    throw new Error('获取天气数据失败，请稍后重试');
  }
});

/**
 * 获取天气预报
 */
export const getWeatherForecast = withCache(async (lat: number, lng: number, days: number = 7) => {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      throw new Error('OpenWeatherMap API Key未配置');
    }

    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=zh_cn&cnt=${days * 8}`; // 每3小时一个预报

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`天气预报API请求失败: ${response.status}`);
    }

    const data = await response.json();

    return data.list.map((item: any) => ({
      datetime: item.dt_txt,
      temp: item.main.temp,
      humidity: item.main.humidity,
      windSpeed: item.wind?.speed || 0,
      windDirection: item.wind?.deg || 0,
      clouds: item.clouds?.all || 0,
      description: item.weather[0]?.description || '未知',
      icon: item.weather[0]?.icon || '01d',
      pressure: item.main?.pressure || 1013,
      pop: item.pop || 0 // 降水概率
    }));

  } catch (error) {
    console.error('获取天气预报失败:', error);
    throw new Error('获取天气预报失败，请稍后重试');
  }
});

/**
 * 计算体感温度
 */
export const calculateFeelsLike = (temp: number, humidity: number, windSpeed: number): number => {
  // 简化版的体感温度计算
  if (temp <= 0) {
    // 低温时的体感温度
    return temp + (windSpeed * 0.1);
  } else if (temp >= 27) {
    // 高温高湿时的体感温度
    const heatIndex = -8.78469475556 + 1.61139411 * temp + 2.33854883889 * humidity
      - 0.14611605 * temp * humidity - 0.012308094 * temp * temp
      - 0.0164248277778 * humidity * humidity;
    return Math.max(temp, heatIndex);
  } else {
    return temp;
  }
};

/**
 * 获取空气质量数据
 */
export const getAirQuality = withCache(async (lat: number, lng: number) => {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      throw new Error('OpenWeatherMap API Key未配置');
    }

    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`空气质量API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const aqi = data.list[0];

    return {
      aqi: aqi.main.aqi, // 1-5，1=好，5=很差
      co: aqi.components.co,
      no2: aqi.components.no2,
      o3: aqi.components.o3,
      so2: aqi.components.so2,
      pm25: aqi.components.pm2_5,
      pm10: aqi.components.pm10,
      nh3: aqi.components.nh3
    };

  } catch (error) {
    console.error('获取空气质量数据失败:', error);
    throw new Error('获取空气质量数据失败，请稍后重试');
  }
});

/**
 * 获取紫外线指数
 */
export const getUVIndex = withCache(async (lat: number, lng: number) => {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      throw new Error('OpenWeatherMap API Key未配置');
    }

    const url = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lng}&appid=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`UV指数API请求失败: ${response.status}`);
    }

    const data = await response.json();

    return {
      value: data.value,
      risk: data.value < 3 ? 'low' : data.value < 6 ? 'moderate' : data.value < 8 ? 'high' : 'very_high',
      time: data.time_iso
    };

  } catch (error) {
    console.error('获取UV指数失败:', error);
    throw new Error('获取UV指数失败，请稍后重试');
  }
});

/**
 * 获取历史天气数据
 */
export const getHistoricalWeather = withCache(async (lat: number, lng: number, timestamp: number) => {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      throw new Error('OpenWeatherMap API Key未配置');
    }

    const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lng}&dt=${timestamp}&appid=${apiKey}&units=metric&lang=zh_cn`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`历史天气API请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.current;

  } catch (error) {
    console.error('获取历史天气失败:', error);
    throw new Error('获取历史天气失败，请稍后重试');
  }
});
