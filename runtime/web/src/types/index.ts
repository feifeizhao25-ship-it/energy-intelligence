// 新能源智库类型定义

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface MonthlyData {
  month: number;
  value: number;
  unit?: string;
}

export interface SolarResource {
  monthly: {
    month: number;
    ghi: number; // 全球水平辐照度 (kWh/m²/day)
    dni: number; // 法向直射辐照度 (kWh/m²/day)
    dhi: number; // 水平散射辐照度 (kWh/m²/day)
    temperature: number; // 月平均气温 (°C)
  }[];
  annual: {
    ghi: number; // 年总辐照度 (kWh/m²/year)
    peakSunHours: number; // 峰值日照小时数
    optimalTilt: number; // 最佳倾角 (度)
    resourceClass: 'I' | 'II' | 'III' | 'IV' | 'V'; // 资源等级
  };
}

export interface WindResource {
  monthly: {
    month: number;
    speed10m: number; // 10m风速 (m/s)
    speed50m: number; // 50m风速 (m/s)
    speed100m: number; // 100m风速 (m/s)
    direction: number | null; // 主导风向（度）；数据源未提供时为 null
  }[];
  annual: {
    avgSpeed: number; // 年平均风速 (m/s)
    powerDensity: number; // 风功率密度 (W/m²)
    equivalentHours: number; // 等效满发小时数 (h)
    resourceClass: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII'; // 资源等级
  };
}

export interface WeatherData {
  temp: number; // 温度 (°C)
  humidity: number; // 湿度 (%)
  windSpeed: number; // 风速 (m/s)
  windDirection: number; // 风向 (度)
  clouds: number; // 云量 (%)
  description: string; // 天气描述
  icon: string; // 天气图标
  pressure: number; // 气压 (hPa)
  visibility: number; // 能见度 (m)
  uvIndex: number; // 紫外线指数
}

export interface PVForecast {
  date: string;
  watts: number; // 瞬时功率 (W)
  wattHours: number; // 发电量 (Wh)
  confidence: number; // 预测置信度 (0-1)
}

export interface SolarCalculationInput {
  lat: number;
  lng: number;
  capacity: number; // kWp
  installationType: 'roof' | 'ground' | 'carport' | 'bifacial';
  moduleType: 'economy' | 'standard' | 'premium';
  tilt?: number; // 倾角 (度)
  azimuth?: number; // 方位角 (度)
  selfUseRatio: number; // 自用比例 (0-1)
  electricityPrice: number; // 自用电价 (元/kWh)
  feedInTariff: number; // 上网电价 (元/kWh)
  unitCost?: number; // 单位成本 (元/kW)
  province: string;
}

export interface SolarCalculationOutput {
  energy: {
    year1: number; // 首年发电量 (kWh)
    monthly: number[]; // 月度发电量数组
    lifetime: number; // 25年总发电量 (kWh)
    specificYield: number; // 比发电量 (kWh/kWp/year)
    equivalentHours: number; // 等效满发小时数 (h)
    pr: number; // 性能比 (%)
    degradation: number[]; // 年度衰减率数组
  };
  financial: {
    investment: number; // 总投资 (元)
    year1Revenue: number; // 首年收益 (元)
    paybackYears: number; // 回本年限
    irr: number; // 内部收益率 (%)
    npv: number; // 净现值 (元)
    lcoe: number; // 平准化度电成本 (元/kWh)
    cashFlow: number[]; // 25年现金流数组
  };
  environmental: {
    co2Year1: number; // 首年CO2减排 (kg)
    co2Lifetime: number; // 25年CO2减排 (kg)
    treesEquivalent: number; // 等效植树 (棵)
  };
}

export interface WindCalculationInput {
  lat: number;
  lng: number;
  province: string;
  projectName: string;
  turbine: {
    type: 'low_wind' | 'medium_wind' | 'high_wind' | 'custom';
    model?: string;
    capacity: number; // 单机容量 (MW)
    count: number; // 风机数量
    hubHeight: number; // 轮毂高度 (m)
    rotorDiameter: number; // 叶轮直径 (m)
    cutInSpeed: number; // 切入风速 (m/s)
    ratedSpeed: number; // 额定风速 (m/s)
    cutOutSpeed: number; // 切出风速 (m/s)
  };
  businessModel: {
    mode: 'full_export' | 'self_use_export';
    selfUseRatio?: number;
    electricityPrice?: number;
    feedInTariff?: number;
    cooperationMode?: 'none' | 'rental' | 'equity' | 'revenue_share';
    cooperation?: {
      rentalFee?: number;
      landArea?: number;
      equityRatio?: number;
      revenueShareRatio?: number;
    };
  };
  investment: {
    unitCost?: number;
    totalInvestment?: number;
  };
  operation: {
    operationYears?: number;
    availability?: number;
    wakeLoss?: number;
    otherLosses?: number;
    omCostPerMW?: number;
    insuranceRate?: number;
  };
}

export interface WindCalculationOutput {
  energy: {
    capacityFactor: number; // 容量因子 (%)
    annualGeneration: number; // 年发电量 (kWh)
    monthly: number[]; // 月度发电量数组
    lifetime: number; // 25年总发电量 (kWh)
  };
  financial: {
    investment: number; // 总投资 (元)
    year1Revenue: number; // 首年收益 (元)
    paybackYears: number; // 回本年限
    irr: number; // 内部收益率 (%)
    npv: number; // 净现值 (元)
    lcoe: number; // 平准化度电成本 (元/kWh)
    cashFlow: number[]; // 25年现金流数组
    villageBenefit?: number; // 村集体收益 (元/年)
  };
  environmental: {
    co2Year1: number; // 首年CO2减排 (kg)
    co2Lifetime: number; // 25年CO2减排 (kg)
    treesEquivalent: number; // 等效植树 (棵)
  };
}

export interface HealthDiagnosisInput {
  lat: number;
  lng: number;
  capacity: number; // kWp
  actualGeneration: number; // 实际发电量 (kWh)
  month: number;
  year: number;
}

export interface HealthDiagnosisOutput {
  theoreticalGen: number; // 理论发电量 (kWh)
  pr: number; // 实际PR (%)
  rating: 'excellent' | 'good' | 'attention' | 'abnormal';
  causes: string[]; // 可能原因
  recommendations: string[]; // 建议措施
}

export interface FaultDiagnosisInput {
  symptom: string;
  deviceType?: 'inverter' | 'panel' | 'optimizer' | 'transformer' | 'grid';
  errorCode?: string;
}

export interface FaultDiagnosisOutput {
  diagnosis: string;
  possibleCauses: string[];
  solutions: string[];
  safetyTips: string[];
  urgencyLevel: 'low' | 'medium' | 'high' | 'emergency';
}

export interface MaintenanceWindow {
  date: string;
  startTime: string;
  endTime: string;
  weather: 'clear' | 'cloudy' | 'rain' | 'snow';
  windSpeed: number; // m/s
  estimatedLoss: number; // 预计发电损失 (kWh)
  recommended: boolean;
}

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  citationCount: number | null;
  pdfUrl?: string;
  tldr?: string;
  venue?: string;
  doi?: string;
  sourceProvider?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  evidenceStatus?: 'provider_verified';
}

export interface SearchOptions {
  yearFrom?: number;
  yearTo?: number;
  openAccess?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  total: number;
  papers: Paper[];
  providers?: Array<{
    name: 'Semantic Scholar' | 'OpenAlex' | 'arXiv';
    status: 'available' | 'unavailable';
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  duration: number; // 响应时间 (ms)
}

export interface ChartData {
  name: string;
  value: number;
  date?: string;
  [key: string]: any;
}

export interface SystemHealthMetrics {
  pvIndex: number; // 光伏发电指数 (0-100)
  windIndex: number; // 风电发电指数 (0-100)
  temperature: number;
  humidity: number;
  weatherDescription: string;
  forecastData: PVForecast[];
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  plan: 'FREE' | 'PRO' | 'MAINTENANCE' | 'FULL';
  dailyUsage: {
    calculations: number;
    diagnoses: number;
    aiQuestions: number;
  };
  limits: {
    dailyCalculations: number;
    dailyDiagnoses: number;
    dailyAIQuestions: number;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string; // 用于 tool 角色
  tool_call_id?: string; // 用于 tool 角色
  tool_calls?: any[]; // 用于 assistant 角色发起调用
  timestamp?: string;
  tools?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
  output?: any;
  status: 'pending' | 'completed' | 'error';
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageCalculationInput {
  capacity: number; // 功率 (kW)
  energy: number; // 容量 (kWh)
  batteryType: 'lithium' | 'sodium' | 'flow' | 'lead_acid';
  location: {
    province: string;
    lat: number;
    lng: number;
  };
  applicationMode: 'arbitrage' | 'peak_shaving' | 'demand_management' | 'backup';
  arbitrageConfig?: {
    chargeTime1: [number, number]; // [startHour, endHour]
    dischargeTime1: [number, number];
    chargeTime2?: [number, number];
    dischargeTime2?: [number, number];
    peakPrice: number;
    valleyPrice: number;
    flatPrice: number;
  };
  demandConfig?: {
    peakReduction: number; // kW
    demandCharge: number; // 元/kW·月
  };
  investment: {
    unitCost: number; // 元/kWh
    totalInvestment?: number;
    financing: 'cash' | 'loan';
    loanRatio?: number;
    loanRate?: number;
  };
  technical: {
    efficiency: number; // % (Round-trip)
    dod: number; // % (Depth of Discharge)
    cycleLife: number; // 次数
    degradationRate: number; // %/year
    maintenanceCostRatio: number; // % of investment
  };
}

export interface StorageCalculationOutput {
  energy: {
    year1: number; // kWh
    efficiency: number; // %
    cycleCount: number;
  };
  financial: {
    investment: number;
    year1Revenue: number;
    paybackYears: number;
    irr: number;
    npv: number;
    lcoe: number;
  };
  environmental: {
    co2Year1: number;
    co2Lifetime: number; // 25年
    treesEquivalent: number;
  };
}

export interface ProjectData {
  id: string;
  name: string;
  type: 'SOLAR' | 'WIND' | 'STORAGE';
  capacity: number;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  commissionDate: string;
}
