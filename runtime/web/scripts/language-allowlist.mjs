// 国内版允许出现的拉丁词（单位、通用缩写、专有名词）。其余拉丁单词在一个页面/文件里超过 3 个即失败。
export const LATIN_ALLOWLIST = new Set([
  'kw', 'kwh', 'mw', 'mwh', 'gw', 'gwh', 'kwp', 'mwp', 'kva', 'w', 'wp', 'v', 'a', 'h', 'm', 'km', 'mm', 'cm', 'kg', 't', 'mpa',
  'pr', 'irr', 'npv', 'lcoe', 'lcos', 'roi', 'dod', 'soc', 'soh', 'iv', 'mppt', 'poa', 'ghi', 'dni', 'dhi', 'p50', 'p90',
  'pdf', 'word', 'excel', 'ppt', 'csv', 'json', 'ai', 'aigc', 'api', 'sdk', 'sso', 'url', 'app', 'id', 'vip', 'faq', 'sla',
  'nasa', 'power', 'nrel', 'pvgis', 'pvwatts', 'iec', 'gb', 'gb/t', 'ieee', 'ccer', 'cbam', 'co2', 'co₂', 'eia', 'irena',
  'semantic', 'scholar', 'doi', 'pv', 'bess', 'ems', 'bms', 'pcs', 'scada', 'om', 'o&m', 'icp', 'sms', 'ip',
  'kwh/m', 'kwh/m²', 'w/m', 'w/m²', 'm/s', 'docx', 'png', 'svg', 'capex', 'opex', 'v1', 'v3', 'openapi', 'x-api-key', 'tier1', 'logo',
  'get', 'post', 'put', 'delete', 'curl',
  'pro', 'deepseek', 'deepseek-v3', 'pdf/word', 'glm', 'kimi', 'qwen', 'openclaw', 'iso', 'gdpr', 'pipl', 'cn', 'utc', 'ok',
]);
export const isAllowed = (word) => LATIN_ALLOWLIST.has(word.toLowerCase()) || /^[a-z]$/i.test(word);
