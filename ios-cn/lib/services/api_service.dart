/// ApiService — real HTTP client for Energy backend v2
/// 生产 HTTPS 地址通过 --dart-define=API_BASE_URL=... 注入。
/// Import http: ^1.6.0 (already in pubspec.yaml)
library;

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiService {
  static final _client = http.Client();
  static const _secureStorage = FlutterSecureStorage();
  static String? _token;
  static final String _baseUrl = const String.fromEnvironment('API_BASE_URL');

  /// Initialize with region — call from main() before runApp
  static Future<void> init({String region = 'CN'}) async {
    if (_baseUrl.isEmpty || !_baseUrl.startsWith('https://')) {
      throw StateError('API_BASE_URL 必须配置为 HTTPS 地址');
    }
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('energy_token');
  }

  static void setToken(String token) => _token = token;
  static void clearToken() => _token = null;

  static Map<String, String> get _headers {
    final h = <String, String>{'Content-Type': 'application/json'};
    if (_token != null) h['Authorization'] = 'Bearer $_token';
    return h;
  }

  static Uri _uri(String path, [Map<String, String>? query]) {
    return Uri.parse('$_baseUrl$path').replace(queryParameters: query);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  static Future<String> register({
    required String name,
    required String email,
    required String password,
    String? company,
    String? role,
  }) async {
    final resp = await _post(
      '/api/v1/auth/register',
      body: {
        'name': name,
        'email': email,
        'password': password,
        'company': ?company,
        'role': ?role,
      },
    );
    final token = resp['access_token'] as String;
    _token = token;
    await _secureStorage.write(key: 'energy_token', value: token);
    return token;
  }

  static Future<String> login({
    required String email,
    required String password,
  }) async {
    final resp = await _post(
      '/api/v1/auth/login',
      body: {'email': email, 'password': password},
    );
    final token = resp['access_token'] as String;
    _token = token;
    await _secureStorage.write(key: 'energy_token', value: token);
    return token;
  }

  static Future<void> logout() async {
    _token = null;
    await _secureStorage.delete(key: 'energy_token');
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> getMe() async {
    return await _get('/api/v1/users/me');
  }

  // ── Projects ───────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> getProjects() async {
    final resp = await _get('/api/v1/projects');
    if (resp is List) {
      return (resp as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    }
    if (resp['data'] is List) {
      return (resp['data'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    }
    return [];
  }

  static Future<Map<String, dynamic>> getProject(String id) async {
    return await _get('/api/v1/projects/$id');
  }

  static Future<Map<String, dynamic>> createProject({
    required String name,
    String? description,
    String? technology,
    double? latitude,
    double? longitude,
    double? capacityMw,
    String? location,
  }) async {
    return await _post(
      '/api/v1/projects',
      body: {
        'name': name,
        'description': ?description,
        'technology': ?technology,
        'latitude': ?latitude,
        'longitude': ?longitude,
        'capacity_mw': ?capacityMw,
        'location': ?location,
      },
    );
  }

  static Future<void> deleteProject(String id) async {
    await _delete('/api/v1/projects/$id');
  }

  // ── Resource ──────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> getSolarResource(
    double lat,
    double lng,
  ) async {
    return await _post(
      '/api/v1/resource/solar',
      body: {'lat': lat, 'lng': lng},
    );
  }

  static Future<Map<String, dynamic>> getWindResource(
    double lat,
    double lng,
  ) async {
    return await _post('/api/v1/resource/wind', body: {'lat': lat, 'lng': lng});
  }

  // ── Finance ───────────────────────────────────────────────────────────────

  /// Solar finance — accepts legacy screen-style map call and returns FinancialModel
  /// Also callable as calcSolarFinance(capacityMw: ..., ...) for named-arg callers
  static Future<Map<String, dynamic>> calcSolarFinance({
    double? capacityMw,
    double? capexPerW,
    double? opexPerKwYr,
    double? electricityPrice,
    double? ghiAnnual,
    double? capacityFactor,
    double degradationRate = 0.005,
    double? itcRate,
    double? debtRatio,
    double? interestRate,
    double? taxRate,
    int projectLife = 25,
    // Legacy map-style support
    Map<String, dynamic>? legacyParams,
  }) async {
    if (legacyParams != null) {
      // Transform legacy screen params to real API format
      final capMw =
          legacyParams['capacityMwp'] ?? legacyParams['capacityMw'] ?? 0.0;
      final capexTotal = legacyParams['capexTotal'] ?? 0.0;
      final pr = legacyParams['pr'] ?? 0.78;
      final opexAnnual = legacyParams['opexAnnual'] ?? 0.0;
      final elecPrice = legacyParams['electricityPrice'] ?? 0.35;
      final ghi = legacyParams['ghiAnnual'] ?? 1456.0;
      // Convert: capexTotal (yuan) -> capex_per_w (yuan/W) = capexTotal / (capMw*1e6)
      final cpW = capexTotal > 0 && capMw > 0
          ? capexTotal / (capMw * 1e6)
          : 4.85;
      // pr (0-1) -> capacity_factor (0-100%)
      final cf = (pr * 100).clamp(0.0, 100.0);
      // opexAnnual (yuan/yr) -> opex_per_kw_yr = opexAnnual / (capMw*1000)
      final opKw = capMw > 0 ? opexAnnual / (capMw * 1000) : 287.5;
      final resp = await _post(
        '/api/v1/finance/solar',
        body: {
          'capacity_mw': capMw,
          'capex_per_w': cpW,
          'opex_per_kw_yr': opKw,
          'electricity_price': elecPrice,
          'ghi_annual': ghi,
          'capacity_factor': cf,
          'degradation_rate': 0.005,
          'project_life': 25,
        },
      );
      return {
        'id': '',
        'modelType': 'solar',
        'modelName': '光伏财务模型',
        'capacityMwp': resp['capacity_mw'] ?? capMw,
        'capexTotal': resp['capex_per_w'] != null
            ? (resp['capex_per_w'] * capMw * 1e6)
            : capexTotal,
        'opexAnnual': resp['opex_per_kw_yr'] != null
            ? (resp['opex_per_kw_yr'] * capMw * 1000)
            : opexAnnual,
        'electricityPrice': resp['electricity_price'] ?? elecPrice,
        'irrEquity': (resp['irr'] ?? resp['irr_equity'] ?? 0.0).toDouble(),
        'npv': (resp['npv'] ?? 0.0).toDouble(),
        'lcoe': (resp['lcoe'] ?? 0.0).toDouble(),
        'paybackStatic': (resp['payback_years'] ?? resp['payback'] ?? 0.0)
            .toDouble(),
        'annualCashflow': _toDoubleList(
          resp['cashflows'] ?? resp['annual_cashflows'] ?? [],
        ),
      };
    }
    return await _post(
      '/api/v1/finance/solar',
      body: {
        'capacity_mw': capacityMw,
        'capex_per_w': capexPerW,
        'opex_per_kw_yr': opexPerKwYr,
        'electricity_price': electricityPrice,
        'ghi_annual': ?ghiAnnual,
        'capacity_factor': ?capacityFactor,
        'degradation_rate': degradationRate,
        'itc_rate': ?itcRate,
        'debt_ratio': ?debtRatio,
        'interest_rate': ?interestRate,
        'tax_rate': ?taxRate,
        'project_life': projectLife,
      },
    );
  }

  static Future<Map<String, dynamic>> calcStorageFinance({
    required double powerMw,
    required double capacityMwh,
    required double cyclesPerYear,
    required double peakPricePerMwh,
    required double offpeakPricePerMwh,
    required double capexPerKwh,
  }) async {
    return await _post(
      '/api/v1/finance/storage',
      body: {
        'power_mw': powerMw,
        'capacity_mwh': capacityMwh,
        'cycles_per_year': cyclesPerYear,
        'peak_price_per_mwh': peakPricePerMwh,
        'offpeak_price_per_mwh': offpeakPricePerMwh,
        'capex_per_kwh': capexPerKwh,
      },
    );
  }

  static Future<Map<String, dynamic>> calculateCleaningSchedule({
    required double cleaningCost,
    required double dailyRevenue,
    required double soilingRateFractionPerDay,
  }) async {
    return await _post(
      '/api/v1/operations/cleaning/calculate',
      body: {
        'cleaning_cost_usd': cleaningCost,
        'daily_revenue_usd': dailyRevenue,
        'soiling_rate_fraction_per_day': soilingRateFractionPerDay,
      },
    );
  }

  static List<double> _toDoubleList(dynamic list) {
    if (list is List) return list.map((v) => (v as num).toDouble()).toList();
    return [];
  }

  static Future<Map<String, dynamic>> calcWindFinance({
    required double capacityMw,
    required double capexPerKw,
    required double opexPerKwYr,
    required double electricityPrice,
    required double windCapacityFactor,
    int projectLifespan = 25,
  }) async {
    return await _post(
      '/api/v1/finance/wind',
      body: {
        'capacity_mw': capacityMw,
        'capex_per_kw': capexPerKw,
        'opex_per_kw_yr': opexPerKwYr,
        'electricity_price': electricityPrice,
        'wind_capacity_factor': windCapacityFactor,
        'project_life': projectLifespan,
      },
    );
  }

  // ── Operations ─────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> getOperationsHealth(
    String projectId,
  ) async {
    return await _get('/api/v1/operations/health', {'projectId': projectId});
  }

  // ── AI Chat ───────────────────────────────────────────────────────────────

  static Future<String> aiChat(List<Map<String, String>> messages) async {
    final resp = await _post(
      '/api/v1/ai_assistant/chat',
      body: {'messages': messages},
    );
    return resp['reply'] ?? resp['content'] ?? resp['message'] ?? '';
  }

  // ── Missing methods needed by screens ──────────────────────────────────────

  /// AI chat — calls POST /api/v1/ai/chat  (returns Map for assistant_screen)
  static Future<Map<String, dynamic>> chat(String message) async {
    try {
      final resp = await _post(
        '/api/v1/ai/chat-json',
        body: {'message': message},
      );
      return resp;
    } catch (_) {
      return {'success': false, 'error': 'AI服务暂时不可用'};
    }
  }

  /// ROI calculation is performed by the audited backend finance service.
  static Future<Map<String, dynamic>> calculateROI(double capacityMw) async {
    throw ApiException(422, '仅凭装机容量无法可靠计算投资回报率，请使用完整财务模型填写成本、电价、运维和资源假设');
  }

  /// Dashboard metrics — calls backend or returns stub
  static Future<Map<String, dynamic>> getDashboardMetrics() async {
    return await _get('/api/v1/dashboard/metrics');
  }

  /// Get alerts — calls backend or returns stub
  static Future<List<Map<String, dynamic>>> getAlerts() async {
    final resp = await _get('/api/v1/operations/alerts');
    final rows = resp['data'] ?? resp['alerts'];
    if (rows is List) {
      return rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  /// Health data — calls backend or returns stub
  static Future<Map<String, dynamic>> getHealthData(String projectId) async {
    return await _get('/api/v1/operations/health/$projectId');
  }

  /// Health report — alias for getHealthData
  static Future<Map<String, dynamic>> getHealthReport(String projectId) async {
    return await getHealthData(projectId);
  }

  /// Research papers — calls backend or returns stub
  static Future<List<Map<String, dynamic>>> getPapers({
    String? query,
    int page = 1,
    int pageSize = 20,
  }) async {
    final resp = await _get('/api/v1/research/papers', {
      'query': ?query,
      'page': page.toString(),
      'pageSize': pageSize.toString(),
    });
    if (resp['data'] is List) {
      return (resp['data'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    }
    if (resp['papers'] is List) {
      return (resp['papers'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    }
    return [];
  }

  /// Get metrics — alias for getDashboardMetrics
  static Future<Map<String, dynamic>> getMetrics() async {
    return await getDashboardMetrics();
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> _get(
    String path, [
    Map<String, String>? query,
  ]) async {
    final resp = await _client
        .get(_uri(path, query), headers: _headers)
        .timeout(const Duration(seconds: 15));
    return _parse(resp);
  }

  static Future<Map<String, dynamic>> _post(
    String path, {
    required Map<String, dynamic> body,
  }) async {
    final resp = await _client
        .post(_uri(path), headers: _headers, body: jsonEncode(body))
        .timeout(const Duration(seconds: 15));
    return _parse(resp);
  }

  static Future<void> _delete(String path) async {
    final resp = await _client
        .delete(_uri(path), headers: _headers)
        .timeout(const Duration(seconds: 15));
    if (resp.statusCode >= 400) throw ApiException(resp.statusCode, resp.body);
  }

  static Map<String, dynamic> _parse(http.Response resp) {
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      if (resp.body.isEmpty) return {};
      final decoded = jsonDecode(resp.body);
      if (decoded is Map<String, dynamic>) return decoded;
      return {'data': decoded};
    }
    String msg = resp.body;
    try {
      msg = jsonDecode(resp.body)['detail'] ?? msg;
    } catch (_) {}
    throw ApiException(resp.statusCode, msg);
  }
}
