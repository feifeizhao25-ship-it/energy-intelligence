// 国内版允许出现的拉丁词：只保留单位与通用缩写。英文单词不收录。
// 缩写在每个文件中首次出现时，同一段可见文字须含中文（见 check-language-purity.mjs 的 GLOSS_ON_FIRST）。
export const LATIN_ALLOWLIST = new Set([
  'kw', 'kwh', 'mw', 'mwh', 'gw', 'gwh', 'kwp', 'mwp', 'kva', 'w', 'wp', 'v', 'a', 'h', 'm', 'km', 'mm', 'cm', 'kg', 't', 'mpa',
  'kg/kwh',
  'pr', 'irr', 'npv', 'lcoe', 'lcos', 'roi', 'dod', 'soc', 'soh', 'iv', 'mppt', 'poa', 'ghi', 'dni', 'dhi', 'p50', 'p90',
  'pdf', 'word', 'excel', 'ppt', 'csv', 'json', 'ai', 'aigc', 'api', 'sdk', 'sso', 'url', 'app', 'id', 'vip', 'faq', 'sla',
  'nasa', 'nrel', 'pvgis', 'pvwatts', 'iec', 'gb', 'gb/t', 'ieee', 'ccer', 'cbam', 'co2', 'co₂', 'eia', 'irena',
  'doi', 'pv', 'bess', 'ems', 'bms', 'pcs', 'scada', 'om', 'o&m', 'icp', 'sms', 'ip',
  'kwh/m', 'kwh/m²', 'w/m', 'w/m²', 'm/s', 'docx', 'png', 'svg', 'capex', 'opex', 'v1', 'v3', 'openapi', 'x-api-key',
  'pro', 'deepseek', 'deepseek-v3', 'pdf/word', 'glm', 'kimi', 'qwen', 'iso', 'gdpr', 'pipl', 'cn', 'utc',
  'get', 'post', 'put', 'patch', 'delete', 'head', 'options',
]);
/** 这些缩写首次出现必须和中文写在同一段，例如「内部收益率（IRR）」。单位（kWh、MW）不在此列。 */
export const GLOSS_ON_FIRST = new Set(['irr', 'lcoe', 'pr', 'npv', 'lcos', 'roi', 'api', 'pdf', 'word', 'excel']);
export const isAllowed = (word) => LATIN_ALLOWLIST.has(word.toLowerCase()) || /^[a-z]$/i.test(word);
