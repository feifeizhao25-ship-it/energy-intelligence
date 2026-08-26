// 2024年中国各省市分布式光伏/风电参考电价数据
export interface ElectricityPriceConfig {
  province: string;
  retailPrice: number; // 工商业平均购电电价 (元/kWh)
  feedInTariff: number; // 脱硫煤标杆上网电价 (元/kWh)
  peakValleySupport: boolean;
  peaks: { start: number; end: number }[];
  valleys: { start: number; end: number }[];
  peakPrice?: number;
  valleyPrice?: number;
}

export const PROVINCE_PRICES: Record<string, ElectricityPriceConfig> = {
  '北京': {
    province: '北京',
    retailPrice: 0.85,
    feedInTariff: 0.3533,
    peakValleySupport: true,
    peaks: [{ start: 10, end: 15 }, { start: 18, end: 21 }],
    valleys: [{ start: 23, end: 7 }],
    peakPrice: 1.25,
    valleyPrice: 0.28
  },
  '上海': {
    province: '上海',
    retailPrice: 0.92,
    feedInTariff: 0.4155,
    peakValleySupport: true,
    peaks: [{ start: 8, end: 11 }, { start: 18, end: 21 }],
    valleys: [{ start: 22, end: 6 }],
    peakPrice: 1.35,
    valleyPrice: 0.31
  },
  '江苏': {
    province: '江苏',
    retailPrice: 0.78,
    feedInTariff: 0.391,
    peakValleySupport: true,
    peaks: [{ start: 8, end: 11 }, { start: 17, end: 22 }],
    valleys: [{ start: 0, end: 8 }],
    peakPrice: 1.15,
    valleyPrice: 0.25
  },
  '浙江': {
    province: '浙江',
    retailPrice: 0.82,
    feedInTariff: 0.4153,
    peakValleySupport: true,
    peaks: [{ start: 9, end: 11 }, { start: 15, end: 17 }, { start: 19, end: 21 }],
    valleys: [{ start: 24, end: 8 }],
    peakPrice: 1.28,
    valleyPrice: 0.26
  },
  '广东': {
    province: '广东',
    retailPrice: 0.88,
    feedInTariff: 0.453,
    peakValleySupport: true,
    peaks: [{ start: 10, end: 12 }, { start: 14, end: 19 }],
    valleys: [{ start: 0, end: 8 }],
    peakPrice: 1.32,
    valleyPrice: 0.29
  },
  '山东': {
    province: '山东',
    retailPrice: 0.72,
    feedInTariff: 0.3949,
    peakValleySupport: true,
    peaks: [{ start: 18, end: 22 }],
    valleys: [{ start: 11, end: 14 }], // 中午深谷，光伏收益受影响
    peakPrice: 1.05,
    valleyPrice: 0.15
  },
  '河北': {
    province: '河北',
    retailPrice: 0.68,
    feedInTariff: 0.3644,
    peakValleySupport: true,
    peaks: [{ start: 17, end: 19 }],
    valleys: [{ start: 11, end: 16 }],
    peakPrice: 0.98,
    valleyPrice: 0.18
  },
  // 更多省份可以继续添加...
};

export function getPriceConfig(province: string): ElectricityPriceConfig {
  return PROVINCE_PRICES[province] || {
    province: '通用',
    retailPrice: 0.75,
    feedInTariff: 0.4,
    peakValleySupport: false,
    peaks: [],
    valleys: [],
  };
}
