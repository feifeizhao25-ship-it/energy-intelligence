import 'package:flutter/material.dart';

class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key});

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  final List<Map<String, dynamic>> _sites = [
    {'name': 'Mojave, CA', 'lat': '35.05', 'lon': '-116.27'},
    {'name': 'Riyadh, SA', 'lat': '24.68', 'lon': '46.72'},
  ];
  bool _isComparing = false;
  List<Map<String, dynamic>>? _results;

  final _nameCtrl = TextEditingController();
  final _latCtrl = TextEditingController();
  final _lonCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _latCtrl.dispose();
    _lonCtrl.dispose();
    super.dispose();
  }

  void _addSite() {
    if (_nameCtrl.text.isEmpty || _latCtrl.text.isEmpty || _lonCtrl.text.isEmpty) return;
    if (_sites.length >= 10) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Maximum 10 sites for comparison')));
      return;
    }
    setState(() {
      _sites.add({'name': _nameCtrl.text, 'lat': _latCtrl.text, 'lon': _lonCtrl.text});
      _nameCtrl.clear();
      _latCtrl.clear();
      _lonCtrl.clear();
    });
  }

  Future<void> _compare() async {
    if (_sites.length < 2) return;
    setState(() { _isComparing = true; _results = null; });
    await Future.delayed(const Duration(milliseconds: 1000));

    // Deterministic mock data keyed by index
    final mock = [
      {'ghi': 2285.4, 'solarClass': 'I', 'solarScore': 96, 'wpd': 182.3, 'windClass': 'III'},
      {'ghi': 2198.7, 'solarClass': 'I', 'solarScore': 94, 'wpd': 145.6, 'windClass': 'IV'},
      {'ghi': 1876.2, 'solarClass': 'II', 'solarScore': 83, 'wpd': 312.4, 'windClass': 'II'},
      {'ghi': 1654.9, 'solarClass': 'II', 'solarScore': 76, 'wpd': 445.8, 'windClass': 'I'},
      {'ghi': 1342.6, 'solarClass': 'III', 'solarScore': 64, 'wpd': 267.3, 'windClass': 'III'},
    ];

    setState(() {
      _results = _sites.asMap().entries.map((e) {
        final m = mock[e.key % mock.length];
        return {
          'name': e.value['name'],
          'lat': e.value['lat'],
          'lon': e.value['lon'],
          'ghi': m['ghi'],
          'solarClass': m['solarClass'],
          'solarScore': m['solarScore'],
          'wpd': m['wpd'],
          'windClass': m['windClass'],
        };
      }).toList()
        ..sort((a, b) => (b['solarScore'] as int).compareTo(a['solarScore'] as int));
      _isComparing = false;
    });
  }

  Color _classColor(String cls) {
    switch (cls) {
      case 'I': return const Color(0xFFEA580C);
      case 'II': return const Color(0xFF059669);
      case 'III': return const Color(0xFF1D4ED8);
      case 'IV': return const Color(0xFF64748B);
      default: return const Color(0xFF64748B);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Multi-site Comparison'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
      ),
      backgroundColor: const Color(0xFFF8FAFC),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Add site form
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: const Color(0xFFE2E8F0)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Add Site', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _nameCtrl,
                    decoration: InputDecoration(
                      labelText: 'Site Name',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(child: TextField(
                      controller: _latCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      decoration: InputDecoration(labelText: 'Latitude (WGS84)', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: TextField(
                      controller: _lonCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      decoration: InputDecoration(labelText: 'Longitude (WGS84)', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
                    )),
                  ]),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _addSite,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Add'),
                      style: OutlinedButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Site list
            Text('Sites to Compare (${_sites.length}/10)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 8),
            ..._sites.asMap().entries.map((e) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: Colors.white, border: Border.all(color: const Color(0xFFE2E8F0)), borderRadius: BorderRadius.circular(8)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(children: [
                    Container(
                      width: 24, height: 24,
                      decoration: const BoxDecoration(color: Color(0xFF1D4ED8), shape: BoxShape.circle),
                      child: Center(child: Text('${e.key + 1}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold))),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(e.value['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        Text('${e.value['lat']}, ${e.value['lon']}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                      ],
                    ),
                  ]),
                  IconButton(
                    icon: const Icon(Icons.close, size: 16, color: Color(0xFF94A3B8)),
                    onPressed: () => setState(() => _sites.removeAt(e.key)),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
            )),
            const SizedBox(height: 14),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: (_sites.length < 2 || _isComparing) ? null : _compare,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7C3AED),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: _isComparing
                    ? const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                        SizedBox(width: 10),
                        Text('Fetching NASA POWER data...'),
                      ])
                    : const Text('Compare Sites', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),

            // Results
            if (_results != null) ...[
              const SizedBox(height: 28),
              const Text('Results (ranked by solar score)', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
              const SizedBox(height: 12),

              ..._results!.asMap().entries.map((e) {
                final r = e.value;
                final rank = e.key + 1;
                final isTop = rank == 1;
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isTop ? const Color(0xFFFFFBEB) : Colors.white,
                    border: Border.all(color: isTop ? const Color(0xFFF59E0B) : const Color(0xFFE2E8F0), width: isTop ? 2 : 1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(children: [
                            Text(isTop ? '🏆' : '#$rank', style: const TextStyle(fontSize: 16)),
                            const SizedBox(width: 8),
                            Text(r['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          ]),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(color: const Color(0xFF1D4ED8), borderRadius: BorderRadius.circular(20)),
                            child: Text('${r['solarScore']} pts', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: _buildResourceTile('GHI', '${r['ghi']} kWh/m²/yr', 'Class ${r['solarClass']}', _classColor(r['solarClass'] as String))),
                        const SizedBox(width: 10),
                        Expanded(child: _buildResourceTile('WPD', '${r['wpd']} W/m²', 'Class ${r['windClass']}', _classColor(r['windClass'] as String))),
                      ]),
                    ],
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildResourceTile(String metric, String value, String cls, Color color) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        border: Border.all(color: color.withOpacity(0.2)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(metric, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
          const SizedBox(height: 3),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF0F172A))),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
            child: Text(cls, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
