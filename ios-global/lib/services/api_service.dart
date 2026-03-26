/// ApiService — real HTTP client for Energy backend v2
/// All methods call http://localhost:4001/api/v1/*
/// Import http: ^1.6.0 (already in pubspec.yaml)

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override String toString() => 'ApiException($statusCode): $message';
}

class ApiService {
  static final _client = http.Client();
  static String? _token;
  static String _baseUrl = 'http://localhost:4001';

  /// Initialize with region — call from main() before runApp
  static Future<void> init({String region = 'CN'}) async {
    // Use real backend on port 4002
    _baseUrl = 'http://localhost:4002';
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
    final resp = await _post('/api/v1/auth/register', body: {
      'name': name, 'email': email, 'password': password,
      if (company != null) 'company': company,
      if (role != null) 'role': role,
    });
    final token = resp['access_token'] as String;
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('energy_token', token);
    return token;
  }

  static Future<String> login({required String email, required String password}) async {
    final resp = await _post('/api/v1/auth/login', body: {
      'email': email, 'password': password,
    });
    final token = resp['access_token'] as String;
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('energy_token', token);
    return token;
  }

  static Future<void> logout() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('energy_token');
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> getMe() async {
    return await _get('/api/v1/users/me');
  }

  // ── Projects ───────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> getProjects() async {
    final resp = await _get('/api/v1/projects');
    if (resp is List) return (resp as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    if (resp['data'] is List) return (resp['data'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
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
    return await _post('/api/v1/projects', body: {
      'name': name,
      if (description != null) 'description': description,
      if (technology != null) 'technology': technology,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (capacityMw != null) 'capacity_mw': capacityMw,
      if (location != null) 'location': location,
    });
  }

  static Future<void> deleteProject(String id) async {
    await _delete('/api/v1/projects/$id');
  }

  // ── Resource ──────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> getSolarResource(double lat, double lng) async {
    return await _post('/api/v1/resource/solar', body: {'lat': lat, 'lng': lng});
  }

  static Future<Map<String, dynamic>> getWindResource(double lat, double lng) async {
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
      final capMw = legacyParams['capacityMwp'] ?? legacyParams['capacityMw'] ?? 0.0;
      final capexTotal = legacyParams['capexTotal'] ?? 0.0;
      final pr = legacyParams['pr'] ?? 0.78;
      final opexAnnual = legacyParams['opexAnnual'] ?? 0.0;
      final elecPrice = legacyParams['electricityPrice'] ?? 0.35;
      final ghi = legacyParams['ghiAnnual'] ?? 1456.0;
      // Convert: capexTotal (yuan) -> capex_per_w (yuan/W) = capexTotal / (capMw*1e6)
      final cpW = capexTotal > 0 && capMw > 0 ? capexTotal / (capMw * 1e6) : 4.85;
      // pr (0-1) -> capacity_factor (0-100%)
      final cf = (pr * 100).clamp(0.0, 100.0);
      // opexAnnual (yuan/yr) -> opex_per_kw_yr = opexAnnual / (capMw*1000)
      final opKw = capMw > 0 ? opexAnnual / (capMw * 1000) : 287.5;
      try {
        final resp = await _post('/api/v1/finance/solar', body: {
          'capacity_mw': capMw,
          'capex_per_w': cpW,
          'opex_per_kw_yr': opKw,
          'electricity_price': elecPrice,
          'ghi_annual': ghi,
          'capacity_factor': cf,
          'degradation_rate': 0.005,
          'project_life': 25,
        });
        // Transform backend response to FinancialModel format
        return {
          'id': '',
          'modelType': 'solar',
          'modelName': '光伏财务模型',
          'capacityMwp': resp['capacity_mw'] ?? capMw,
          'capexTotal': resp['capex_per_w'] != null ? (resp['capex_per_w'] * capMw * 1e6) : capexTotal,
          'opexAnnual': resp['opex_per_kw_yr'] != null ? (resp['opex_per_kw_yr'] * capMw * 1000) : opexAnnual,
          'electricityPrice': resp['electricity_price'] ?? elecPrice,
          'irrEquity': (resp['irr'] ?? resp['irr_equity'] ?? 0.0).toDouble(),
          'npv': (resp['npv'] ?? 0.0).toDouble(),
          'lcoe': (resp['lcoe'] ?? 0.0).toDouble(),
          'paybackStatic': (resp['payback_years'] ?? resp['payback'] ?? 0.0).toDouble(),
          'annualCashflow': _toDoubleList(resp['cashflows'] ?? resp['annual_cashflows'] ?? []),
        };
      } catch (_) {
        // Fallback: compute locally
        final annualGen = capMw * 1e6 * ghi / 1000 * pr / 1000;
        final annualRevenue = annualGen * elecPrice;
        final annualOp = opexAnnual;
        final netAnnual = annualRevenue - annualOp;
        final totalCapex = capexTotal;
        final lcoe = totalCapex > 0 && annualGen > 0 ? totalCapex / annualGen / 25 : 0.0;
        final irr = netAnnual > 0 && totalCapex > 0 ? netAnnual / totalCapex * 100 : 0.0;
        final payback = netAnnual > 0 ? totalCapex / netAnnual : 0.0;
        return {
          'id': '',
          'modelType': 'solar',
          'modelName': '光伏财务模型',
          'capacityMwp': capMw,
          'capexTotal': capexTotal,
          'opexAnnual': opexAnnual,
          'electricityPrice': elecPrice,
          'irrEquity': irr,
          'npv': netAnnual * 25 - totalCapex,
          'lcoe': lcoe,
          'paybackStatic': payback,
          'annualCashflow': List.generate(25, (i) => netAnnual),
        };
      }
    }
    return await _post('/api/v1/finance/solar', body: {
      'capacity_mw': capacityMw,
      'capex_per_w': capexPerW,
      'opex_per_kw_yr': opexPerKwYr,
      'electricity_price': electricityPrice,
      if (ghiAnnual != null) 'ghi_annual': ghiAnnual,
      if (capacityFactor != null) 'capacity_factor': capacityFactor,
      'degradation_rate': degradationRate,
      if (itcRate != null) 'itc_rate': itcRate,
      if (debtRatio != null) 'debt_ratio': debtRatio,
      if (interestRate != null) 'interest_rate': interestRate,
      if (taxRate != null) 'tax_rate': taxRate,
      'project_life': projectLife,
    });
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
    required double windSpeedAnnual,
    int projectLifespan = 25,
  }) async {
    return await _post('/api/v1/finance/wind', body: {
      'capacityMw': capacityMw,
      'capexPerKw': capexPerKw,
      'opexPerKwYr': opexPerKwYr,
      'electricityPrice': electricityPrice,
      'windSpeedAnnual': windSpeedAnnual,
      'projectLifespan': projectLifespan,
    });
  }

  // ── Operations ─────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> getOperationsHealth(String projectId) async {
    return await _get('/api/v1/operations/health', {'projectId': projectId});
  }

  // ── AI Chat ───────────────────────────────────────────────────────────────

  static Future<String> aiChat(List<Map<String, String>> messages) async {
    final resp = await _post('/api/v1/ai_assistant/chat', body: {'messages': messages});
    return resp['reply'] ?? resp['content'] ?? resp['message'] ?? '';
  }

  // ── Missing methods needed by screens ──────────────────────────────────────

  /// AI chat — calls POST /api/v1/ai/chat  (returns Map for assistant_screen)
  static Future<Map<String, dynamic>> chat(String message) async {
    try {
      final resp = await _post('/api/v1/ai/chat', body: {'message': message});
      return resp;
    } catch (_) {
      return {'success': false, 'error': 'AI服务暂时不可用'};
    }
  }

  /// ROI calculation — local calculation
  static Future<Map<String, dynamic>> calculateROI(double capacityMw) async {
    final netAnnual = 300.0 * capacityMw; // stub: estimate
    final initialInvestment = capacityMw * 4850000;
    final total = netAnnual * 25 - initialInvestment;
    final roi = (total / initialInvestment) * 100;
    return {
      'total_roi': roi,
      'net_profit': total,
      'payback_years': initialInvestment / netAnnual,
      'annual_net': netAnnual,
    };
  }

  /// Dashboard metrics — calls backend or returns stub
  static Future<Map<String, dynamic>> getDashboardMetrics() async {
    try {
      return await _get('/api/v1/dashboard/metrics');
    } catch (_) {
      return {
        'total_projects': 0,
        'total_capacity_mw': 0.0,
        'total_irr': 0.0,
        'alerts_count': 0,
      };
    }
  }

  /// Get alerts — calls backend or returns stub
  static Future<List<Map<String, dynamic>>> getAlerts() async {
    try {
      final resp = await _get('/api/v1/alerts');
      if (resp is List) return (resp as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      if (resp['alerts'] is List) return (resp['alerts'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      return [];
    } catch (_) {
      return [];
    }
  }

  /// Health data — calls backend or returns stub
  static Future<Map<String, dynamic>> getHealthData(String projectId) async {
    try {
      return await _get('/api/v1/operations/health/$projectId');
    } catch (_) {
      return {'status': 'unknown', 'score': 0.0};
    }
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
    try {
      final resp = await _get('/api/v1/research/papers', {
        if (query != null) 'query': query,
        'page': page.toString(),
        'pageSize': pageSize.toString(),
      });
      if (resp['data'] is List) return (resp['data'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      if (resp['papers'] is List) return (resp['papers'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      return [];
    } catch (_) {
      return [];
    }
  }

  /// Get metrics — alias for getDashboardMetrics
  static Future<Map<String, dynamic>> getMetrics() async {
    return await getDashboardMetrics();
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> _get(String path, [Map<String, String>? query]) async {
    final resp = await _client
        .get(_uri(path, query), headers: _headers)
        .timeout(const Duration(seconds: 15));
    return _parse(resp);
  }

  static Future<Map<String, dynamic>> _post(String path, {required Map<String, dynamic> body}) async {
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
    try { msg = jsonDecode(resp.body)['detail'] ?? msg; } catch (_) {}
    throw ApiException(resp.statusCode, msg);
  }
}
