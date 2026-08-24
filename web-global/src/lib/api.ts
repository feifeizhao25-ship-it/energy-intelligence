// API_BASE: 同source (use Next.js rewrites proxy /api/v1/* -> 127.0.0.1:8002, 避免 CORS)
declare const process: { env: { NEXT_PUBLIC_API_URL?: string } };
const API_BASE = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || '';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // V23: moresource token 探test (兼容 localStorage/sessionStorage/cookie)
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('auth_token') || localStorage.getItem('token')
         || sessionStorage.getItem('auth_token') || sessionStorage.getItem('token');
    if (!token) {
      // from cookie 找
      const m = document.cookie.match(/(?:auth_token|access_token|token)=([^;]+)/);
      if (m) token = decodeURIComponent(m[1]);
    }
  }
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    throw new Error(err.error?.message || err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  subscription_plan?: string;
  quota_used?: number;
  quota_limit?: number;
  role?: string;
  created_at?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<ApiResponse<{ user: User; token: string }>>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (data: Record<string, string>) =>
    fetchApi<ApiResponse<{ user: User; token: string }>>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  logout: () => fetchApi<ApiResponse<void>>('/api/v1/auth/logout', { method: 'POST' }),
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const userApi = {
  me: () => fetchApi<ApiResponse<{ user: User }>>('/api/v1/users/me'),
  update: (data: Partial<User>) =>
    fetchApi<ApiResponse<{ user: User }>>('/api/v1/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ── Projects ──────────────────────────────────────────────────────────────────

export interface ProjectListResponse {
  projects: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const projectApi = {
  list: (page = 1, limit = 10) =>
    fetchApi<ApiResponse<ProjectListResponse>>(`/api/v1/projects?page=${page}&limit=${limit}`),
  get: (id: string) => fetchApi<ApiResponse<unknown>>(`/api/v1/projects/${id}`),
  create: (data: unknown) =>
    fetchApi<ApiResponse<unknown>>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    fetchApi<ApiResponse<void>>(`/api/v1/projects/${id}`, { method: 'DELETE' }),
};

// ── Resource ──────────────────────────────────────────────────────────────────

export const resourceApi = {
  assessSolar: (lat: number, lng: number, dataSource = 'nasa_power') =>
    fetchApi<ApiResponse<unknown>>('/api/v1/resource/solar', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, data_source: dataSource }),
    }),
  assessWind: (lat: number, lng: number, hubHeight = 100) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/resource/wind', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, hub_height: hubHeight }),
    }),
  list: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/resource'),
  getHistory: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/resource/history'),
};

// ── Finance ───────────────────────────────────────────────────────────────────

export interface LCOEInput {
 capex: number; // beginning Investment ( CNY)
  annual_opex: number;      //  yrOperations ( CNY)
 annual_gen_kwh: number; // yr (kWh)
  discount_rate?: number;   // Discount Rate (default 0.06)
 lifetime?: number; // project (default 25)
 degradation?: number; // yr subtract (default 0.004)
 currency?: string; // (default CNY)
}
export interface LCOEResult { lcoe: number; unit: string; }

export interface IRRInput {
  initial_investment: number;
  annual_cash_flows: number[];
  discount_rate?: number;
}
export interface NPVInput {
  initial_investment: number;
  annual_cash_flows: number[];
  discount_rate: number;
}

export const financeApi = {
  lcoe: (input: LCOEInput) =>
    fetchApi<ApiResponse<LCOEResult>>('/api/v1/finance/lcoe', {
      method: 'POST', body: JSON.stringify(input),
    }),
  irr: (input: IRRInput) =>
    fetchApi<ApiResponse<{ irr: number }>>('/api/v1/finance/irr', {
      method: 'POST', body: JSON.stringify(input),
    }),
  npv: (input: NPVInput) =>
    fetchApi<ApiResponse<{ npv: number }>>('/api/v1/finance/npv', {
      method: 'POST', body: JSON.stringify(input),
    }),
  solar: (input: { capacity_mw: number; lat: number; lng: number; tilt?: number;
    capex_per_w?: number; opex_per_kw_yr?: number; electricity_price?: number;
    ghi_annual?: number; capacity_factor?: number; lifetime?: number; }) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/finance/solar', {
      method: 'POST', body: JSON.stringify(input),
    }),
  wind: (input: { capacity_mw: number; lat: number; lng: number; hub_height?: number;
    capex_per_kw?: number; opex_per_kw_yr?: number; electricity_price?: number;
    wind_speed?: number; wind_capacity_factor?: number; lifetime?: number; }) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/finance/wind', {
      method: 'POST', body: JSON.stringify(input),
    }),
  quickModel: (input: unknown) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/finance/quick-model', {
      method: 'POST', body: JSON.stringify(input),
    }),
  monteCarlo: (input: unknown) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/finance/monte-carlo', {
      method: 'POST', body: JSON.stringify(input),
    }),
  depreciation: (input: unknown) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/finance/depreciation', {
      method: 'POST', body: JSON.stringify(input),
    }),
  models: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/finance/models'),
  compare: (items: unknown[]) =>
    fetchApi<ApiResponse<unknown[]>>('/api/v1/finance/compare', {
      method: 'POST', body: JSON.stringify({ items }),
    }),
  // V23 兼容oldpage面 (legacy)
  calculate: (inputs: { type?: string; [k: string]: unknown }) => {
    if (inputs.type === 'solar' || inputs.type === 'wind') {
      return fetchApi<ApiResponse<unknown>>(`/api/v1/finance/${inputs.type}`, {
        method: 'POST', body: JSON.stringify(inputs),
      });
    }
    return fetchApi<ApiResponse<unknown>>('/api/v1/finance/quick-model', {
      method: 'POST', body: JSON.stringify(inputs),
    });
  },
  sensitivity: (baseInputs: unknown, variable: string, range: number[]) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/finance/sensitivity', {
      method: 'POST', body: JSON.stringify({ base_inputs: baseInputs, variable, range }),
    }),
};

// ── Operations ────────────────────────────────────────────────────────────────

export const operationsApi = {
  healthReport: (projectId: string) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/operations/health/${projectId}`),
  anomalyDetection: (projectId: string) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/operations/anomaly/${projectId}`),
  alerts: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/operations/alerts'),
  stats: () => fetchApi<ApiResponse<unknown>>('/api/v1/operations/stats'),
  sites: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/operations/sites'),
};

// ── AI ────────────────────────────────────────────────────────────────────────

export const aiApi = {
  chat: (conversationId: string, message: string) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId, message }),
    }),
  conversations: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/ai/conversations'),
  skills: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/ai/skills'),
};

// ── Billing ───────────────────────────────────────────────────────────────────

export const billingApi = {
  createCheckout: (priceId: string, currency = 'USD') =>
    fetchApi<ApiResponse<{ url: string }>>('/api/v1/billing/create-checkout', {
      method: 'POST',
      body: JSON.stringify({ price_id: priceId, currency }),
    }),
  portal: () => fetchApi<ApiResponse<{ url: string }>>('/api/v1/billing/portal'),
  invoices: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/billing/invoices'),
};

// ── Notifications / Alerts ────────────────────────────────────────────────────

export interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  time: string;
  isRead: boolean;
}

export const notificationsApi = {
  list: () => fetchApi<ApiResponse<AlertItem[]>>('/api/v1/notifications'),
  markRead: (id: string) =>
    fetchApi<ApiResponse<void>>(`/api/v1/notifications/${id}/read`, { method: 'POST' }),
};

// ── Reports ───────────────────────────────────────────────────────────────────

export interface ReportItem {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  size?: string;
  projectCount: number;
  createdBy: string;
  downloads: number;
}

export interface ScheduledReportItem {
  id: string;
  name: string;
  template: string;
  frequency: string;
  recipients: string[];
  lastRun?: string;
  nextRun: string;
  status: string;
  format: string;
}

export const researchApi = {
  papers: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/research/papers'),
  trends: (category?: string) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/research/trends${category ? `?category=${category}` : ''}`),
  marketTrends: () => fetchApi<ApiResponse<unknown>>('/api/v1/research/market-trends'),
  technology: (techType: string) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/research/technologies/${techType}`),
};

// ── External APIs (NREL / Nominatim / Alpha Vantage / REST Countries) ──────────

export const externalApi = {
  weather: (lat: number, lng: number) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/external/weather?lat=${lat}&lng=${lng}`),
  weatherHistorical: (lat: number, lng: number, start: string, end: string) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/external/weather/historical?lat=${lat}&lng=${lng}&start_date=${start}&end_date=${end}`),
  pvwatts: (input: { lat: number; lng: number; capacity_kw: number; tilt?: number; azimuth?: number; }) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/external/pvwatts', {
      method: 'POST', body: JSON.stringify(input),
    }),
  geocode: (q: string) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/external/geocode?q=${encodeURIComponent(q)}`),
  reverseGeocode: (lat: number, lng: number) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/external/reverse-geocode?lat=${lat}&lng=${lng}`),
  carbonIntensity: () => fetchApi<ApiResponse<unknown>>('/api/v1/external/carbon-intensity'),
  carbonFactors: () => fetchApi<ApiResponse<unknown>>('/api/v1/external/carbon-intensity/factors'),
  stockQuote: (symbol: string) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/external/stock/quote?symbol=${symbol}`),
  stockIntraday: (symbol: string, interval = '60min') =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/external/stock/intraday?symbol=${symbol}&interval=${interval}`),
  country: (name: string) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/external/country?name=${encodeURIComponent(name)}`),
  countries: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/external/countries'),
};

// ── External APIs (NREL / Nominatim / Alpha Vantage / REST Countries) ──────────

export const uxApi = {
  favorites: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/ux/favorites'),
  addFavorite: (input: { type: string; ref_id: string; title: string; }) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/ux/favorites', { method: 'POST', body: JSON.stringify(input) }),
  removeFavorite: (id: string) =>
    fetchApi<ApiResponse<void>>(`/api/v1/ux/favorites/${id}`, { method: 'DELETE' }),
  dailyBrief: () => fetchApi<ApiResponse<unknown>>('/api/v1/ux/daily-brief'),
  health: () => fetchApi<ApiResponse<unknown>>('/api/v1/ux/health'),
  onboardingStatus: () => fetchApi<ApiResponse<unknown>>('/api/v1/ux/onboarding/status'),
  units: () => fetchApi<ApiResponse<unknown>>('/api/v1/ux/calculator/units'),
  convert: (input: { value: number; from: string; to: string; category: string; }) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/ux/calculator/convert', { method: 'POST', body: JSON.stringify(input) }),
  quickAssess: (input: { lat: number; lng: number; type: string; }) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/ux/quick-assess', { method: 'POST', body: JSON.stringify(input) }),
  popularCities: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/ux/quick-assess/popular-cities'),
  terminology: (term?: string) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/ux/terminology${term ? `?term=${term}` : ''}`),
  recentActivities: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/ux/recent-activities'),
  presets: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/ux/presets'),
};

// ── Fal.ai (V22 realmore模态) ────────────────────────────────────────────────────

export interface TTSRequest { text: string; voice?: string; }
export interface T2VRequest { prompt: string; model_id?: string; num_inference_steps?: number; }

export const falApi = {
  status: () => fetchApi<ApiResponse<unknown>>('/api/v1/fal/status'),
  tts: (req: TTSRequest) =>
    fetchApi<ApiResponse<{ audio_url: string; model_name: string; duration_estimate_s: number; elapsed_s: number; }>>('/api/v1/fal/tts', {
      method: 'POST', body: JSON.stringify(req),
    }),
  t2v: (req: T2VRequest) =>
    fetchApi<ApiResponse<{ video_url: string; model_name: string; elapsed_s: number; }>>('/api/v1/fal/t2v', {
      method: 'POST', body: JSON.stringify(req),
    }),
};

// ── Admin (需 admin role) ──────────────────────────────────────────────────────

export const adminApi = {
  users: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/admin/users'),
  aiStats: () => fetchApi<ApiResponse<unknown>>('/api/v1/admin/ai-stats'),
  skills: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/admin/skills'),
  systemHealth: () => fetchApi<ApiResponse<unknown>>('/api/v1/admin/system/health'),
  auditLogs: (page = 1, pageSize = 20) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/audit/logs?page=${page}&page_size=${pageSize}`),
  myLogs: (page = 1, pageSize = 20) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/audit/logs/my?page=${page}&page_size=${pageSize}`),
};

export const reportsApi = {
  list: () => fetchApi<ApiResponse<{ reports: ReportItem[] }>>('/api/reports'),
  get: (id: string) => fetchApi<ApiResponse<{ report: ReportItem }>>(`/api/v1/reports/${id}`),
  generate: (data: { projectId: string; type: string; format?: string }) =>
    fetchApi<ApiResponse<unknown>>('/api/v1/reports/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  scheduled: {
    list: () => fetchApi<ApiResponse<{ schedules: ScheduledReportItem[] }>>('/api/reports/scheduled'),
    create: (data: Omit<ScheduledReportItem, 'id' | 'status'>) =>
      fetchApi<ApiResponse<{ schedule: ScheduledReportItem }>>('/api/reports/scheduled', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchApi<ApiResponse<void>>(`/api/v1/reports/scheduled/${id}`, { method: 'DELETE' }),
  },
};

// ── Knowledge Base (Vector Search) ────────────────────────────────────────────

export const knowledgeApi = {
  search: (query: string, topK = 10) =>
    fetchApi<ApiResponse<unknown[]>>('/api/v1/knowledge/search', {
      method: 'POST',
      body: JSON.stringify({ query, top_k: topK }),
    }),
  documents: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/knowledge/documents'),
  uploadDocument: (file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE}/api/v1/knowledge/documents`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  },
  deleteDocument: (id: string) =>
    fetchApi<ApiResponse<void>>(`/api/v1/knowledge/documents/${id}`, { method: 'DELETE' }),
  vectorizeDocument: (id: string) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/knowledge/documents/${id}/vectorize`, { method: 'POST' }),
};

// ── Plant Data ────────────────────────────────────────────────────────────────

export const plantDataApi = {
  stats: () => fetchApi<ApiResponse<unknown>>('/api/v1/plant-data/stats'),
  query: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return fetchApi<ApiResponse<unknown[]>>(`/api/v1/plant-data/query?${qs}`);
  },
  inverters: () => fetchApi<ApiResponse<unknown[]>>('/api/v1/plant-data/inverters'),
  bulkImport: (file: File, dataType: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('data_type', dataType);
    return fetch(`${API_BASE}/api/v1/plant-data/import`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  },
};


// V28 P84: Skills API
export const skillsApi = {
  // columnout skills (支持 category filter + analysispage)
  list: (params?: { category?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    const qs = q.toString();
    return fetchApi<ApiResponse<{ items: unknown[]; total: number }>>(`/api/v1/ai/skills${qs ? '?' + qs : ''}`);
  },
  //  Sync执line skill
  execute: (skillId: string, params: Record<string, unknown>) =>
    fetchApi<ApiResponse<{ result: unknown; status: string; skill_id: string }>>(
      `/api/v1/skills/${skillId}/execute`,
      { method: 'POST', body: JSON.stringify(params) }),
  //  Async执line
  executeAsync: (skillId: string, params: Record<string, unknown>) =>
    fetchApi<ApiResponse<{ task_id: string; status: string }>>(
      `/api/v1/skills/${skillId}/execute?async=true`,
      { method: 'POST', body: JSON.stringify(params) }),
  // 获取 schema
  schema: (skillId: string) =>
    fetchApi<ApiResponse<unknown>>(`/api/v1/skills/${skillId}/schema`),
};

export const dashboardApi = {
  metrics: () => fetchApi<ApiResponse<unknown>>('/api/v1/dashboard/metrics'),
};
