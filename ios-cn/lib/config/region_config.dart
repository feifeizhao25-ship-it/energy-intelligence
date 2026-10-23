/// 区域配置 - 中文版
class RegionConfig {
  static const String region = 'CN';
  static const String appName = '新能源智库';
  static const String language = 'zh';
  static const String currency = 'CNY';
  static const String currencySymbol = '¥';
  // 正式域名在发版时用 --dart-define=API_BASE_URL=https://你的域名 注入。
  // 没有注入时留空，避免打到过期的临时隧道。
  static const String apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: '');
  static const String mapProvider = 'amap';
}
