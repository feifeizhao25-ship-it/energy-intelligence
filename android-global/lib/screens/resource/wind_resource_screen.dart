import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../widgets/bar_chart.dart';

class WindResourceScreen extends StatefulWidget {
  const WindResourceScreen({super.key});
  @override
  State<WindResourceScreen> createState() => _WindResourceScreenState();
}

class _WindResourceScreenState extends State<WindResourceScreen> {
  final _lat = TextEditingController();
  final _lng = TextEditingController();
  Map<String, dynamic>? _result;
  String? _error;
  bool _loading = false;

  @override
  void dispose() {
    _lat.dispose();
    _lng.dispose();
    super.dispose();
  }

  Future<void> _assess() async {
    final lat = double.tryParse(_lat.text);
    final lng = double.tryParse(_lng.text);
    if (lat == null ||
        lng == null ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180) {
      setState(() => _error = 'Enter valid WGS84 coordinates.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });
    try {
      final result = await ApiService.getWindResource(lat, lng);
      if (mounted) setState(() => _result = result);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Verified wind resource data is temporarily unavailable.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  double _number(String key) => (_result?[key] as num?)?.toDouble() ?? 0;
  List<double> get _monthly =>
      ((_result?['monthly_speed'] as List?) ?? const [])
          .whereType<num>()
          .map((v) => v.toDouble())
          .toList();

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Wind Resource')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Coordinates',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _lat,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                  signed: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Latitude (WGS84)',
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _lng,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                  signed: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Longitude (WGS84)',
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _loading ? null : _assess,
          child: _loading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Assess site'),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ),
        if (_result != null) ...[
          const SizedBox(height: 24),
          const Text(
            'Source: Open-Meteo provider response',
            style: TextStyle(color: Color(0xFF475569)),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _WindMetric(
                'Resource class',
                _result?['resource_class']?.toString() ?? '—',
              ),
              _WindMetric('Score', _number('score').toStringAsFixed(1)),
              _WindMetric(
                'Mean speed',
                '${_number('mean_speed').toStringAsFixed(2)} m/s',
              ),
              _WindMetric(
                'Power density',
                '${_number('wind_power_density').toStringAsFixed(1)} W/m²',
              ),
              _WindMetric('Weibull k', _number('weibull_k').toStringAsFixed(2)),
              _WindMetric(
                'Turbulence',
                '${(_number('turbulence_intensity') * 100).toStringAsFixed(1)}%',
              ),
            ],
          ),
          if (_monthly.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 20),
              child: BarChart(
                values: _monthly,
                title: 'Monthly wind speed (provider data)',
              ),
            ),
        ],
      ],
    ),
  );
}

class _WindMetric extends StatelessWidget {
  final String label;
  final String value;
  const _WindMetric(this.label, this.value);
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 160,
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: Color(0xFF64748B))),
            const SizedBox(height: 6),
            Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    ),
  );
}
