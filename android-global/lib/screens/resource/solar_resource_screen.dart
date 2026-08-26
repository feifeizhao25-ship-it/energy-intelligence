import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../widgets/bar_chart.dart';

class SolarResourceScreen extends StatefulWidget {
  const SolarResourceScreen({super.key});
  @override
  State<SolarResourceScreen> createState() => _SolarResourceScreenState();
}

class _SolarResourceScreenState extends State<SolarResourceScreen> {
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
      final result = await ApiService.getSolarResource(lat, lng);
      if (mounted) setState(() => _result = result);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted)
        setState(
          () => _error =
              'Verified solar resource data is temporarily unavailable.',
        );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  double _number(String key) => (_result?[key] as num?)?.toDouble() ?? 0;
  List<double> get _monthly => ((_result?['monthly_ghi'] as List?) ?? const [])
      .whereType<num>()
      .map((v) => v.toDouble())
      .toList();

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Solar Resource')),
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
          Text(
            'Source: ' +
                (_result?['data_source']?.toString() ?? 'Not supplied'),
            style: const TextStyle(color: Color(0xFF475569)),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _Metric(
                'Resource class',
                _result?['resource_class']?.toString() ?? '—',
              ),
              _Metric('Score', _number('score').toStringAsFixed(1)),
              _Metric(
                'GHI',
                _number('ghi').toStringAsFixed(1) + ' kWh/m²/year',
              ),
              _Metric(
                'DNI',
                _number('dni').toStringAsFixed(1) + ' kWh/m²/year',
              ),
              _Metric(
                'DHI',
                _number('dhi').toStringAsFixed(1) + ' kWh/m²/year',
              ),
              _Metric(
                'Peak sun hours',
                _number('peak_sun_hours').toStringAsFixed(2),
              ),
            ],
          ),
          if (_monthly.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 20),
              child: BarChart(
                values: _monthly,
                title: 'Monthly GHI (provider data)',
              ),
            ),
        ],
      ],
    ),
  );
}

class _Metric extends StatelessWidget {
  final String label;
  final String value;
  const _Metric(this.label, this.value);
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
