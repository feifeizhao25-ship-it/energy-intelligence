import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/resource_assessment.dart';

class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key});

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  final List<Map<String, dynamic>> _sites = [];
  bool _isComparing = false;
  List<Map<String, dynamic>>? _results;

  final _nameController = TextEditingController();
  final _latController = TextEditingController();
  final _lonController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _latController.dispose();
    _lonController.dispose();
    super.dispose();
  }

  void _addSite() {
    if (_nameController.text.isEmpty ||
        _latController.text.isEmpty ||
        _lonController.text.isEmpty) {
      return;
    }
    if (_sites.length >= 10) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('最多支持10个站址对比')));
      return;
    }
    setState(() {
      _sites.add({
        'name': _nameController.text,
        'lat': _latController.text,
        'lon': _lonController.text,
      });
      _nameController.clear();
      _latController.clear();
      _lonController.clear();
    });
  }

  void _removeSite(int index) {
    setState(() => _sites.removeAt(index));
  }

  Future<void> _compare() async {
    if (_sites.isEmpty) return;
    setState(() {
      _isComparing = true;
      _results = null;
    });
    try {
      final rows = await Future.wait(
        _sites.map((site) async {
          final lat = double.parse(site['lat'] as String);
          final lon = double.parse(site['lon'] as String);
          final responses = await Future.wait([
            ApiService.getSolarResource(lat, lon),
            ApiService.getWindResource(lat, lon),
          ]);
          final solar = ResourceAssessment.fromJson(responses[0]);
          final wind = ResourceAssessment.fromJson(responses[1]);
          return {
            'name': site['name'],
            'lat': site['lat'],
            'lon': site['lon'],
            'ghi': solar.ghiAnnual.toStringAsFixed(1),
            'solarClass': solar.siteGrade,
            'solarScore': solar.siteScore,
            'wpd': wind.windPowerDensity.toStringAsFixed(1),
            'windClass': wind.siteGrade,
          };
        }),
      );
      rows.sort(
        (a, b) => (b['solarScore'] as num).compareTo(a['solarScore'] as num),
      );
      if (mounted) setState(() => _results = rows);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('真实资源数据暂时不可用，请稍后重试')));
      }
    } finally {
      if (mounted) setState(() => _isComparing = false);
    }
  }

  Color _classColor(String cls) {
    switch (cls) {
      case 'I':
        return Color(0xFFEA580C);
      case 'II':
        return Color(0xFF059669);
      case 'III':
        return Color(0xFF1D4ED8);
      case 'IV':
        return Color(0xFF64748B);
      default:
        return Color(0xFF64748B);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('多站址对比'),
        backgroundColor: const Color(0xFF1D4ED8),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Add site form
            Container(
              padding: EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Color(0xFFF8FAFC),
                border: Border.all(color: Color(0xFFE2E8F0)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '添加站址',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  SizedBox(height: 12),
                  TextField(
                    controller: _nameController,
                    decoration: InputDecoration(
                      labelText: '站址名称',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                  ),
                  SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _latController,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: '纬度',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                          ),
                        ),
                      ),
                      SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _lonController,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: '经度',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _addSite,
                      icon: Icon(Icons.add),
                      label: Text('添加'),
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 16),

            // Sites list
            Text(
              '待对比站址 (${_sites.length}/10)',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            SizedBox(height: 8),
            ..._sites.asMap().entries.map(
              (e) => Container(
                margin: EdgeInsets.only(bottom: 8),
                padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: Color(0xFFE2E8F0)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: Color(0xFF1D4ED8),
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(
                              '${e.key + 1}',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                        SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              e.value['name'] as String,
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            Text(
                              '${e.value['lat']}, ${e.value['lon']}',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    IconButton(
                      icon: Icon(
                        Icons.close,
                        size: 18,
                        color: Color(0xFF94A3B8),
                      ),
                      onPressed: () => _removeSite(e.key),
                      padding: EdgeInsets.zero,
                      constraints: BoxConstraints(),
                    ),
                  ],
                ),
              ),
            ),

            SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: (_sites.length < 2 || _isComparing)
                    ? null
                    : _compare,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Color(0xFF7C3AED),
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: _isComparing
                    ? Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          ),
                          SizedBox(width: 12),
                          Text('正在获取资源数据...'),
                        ],
                      )
                    : Text(
                        '开始对比分析',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),

            // Results
            if (_results != null) ...[
              SizedBox(height: 32),
              Text(
                '对比结果 (按综合评分排序)',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
              SizedBox(height: 12),

              ..._results!.asMap().entries.map((e) {
                final r = e.value;
                final rank = e.key + 1;
                final isTop = rank == 1;
                return Container(
                  margin: EdgeInsets.only(bottom: 12),
                  padding: EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isTop ? Color(0xFFFFFBEB) : Colors.white,
                    border: Border.all(
                      color: isTop ? Color(0xFFF59E0B) : Color(0xFFE2E8F0),
                      width: isTop ? 2 : 1,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Text(
                                isTop ? '🏆' : '#$rank',
                                style: TextStyle(fontSize: 18),
                              ),
                              SizedBox(width: 8),
                              Text(
                                r['name'] as String,
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Color(0xFF1D4ED8),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              '${r['solarScore']} 分',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _buildResourceMetric(
                              'GHI',
                              '${r['ghi']} kWh/m²',
                              '太阳资源 ${r['solarClass']}类',
                              _classColor(r['solarClass'] as String),
                            ),
                          ),
                          SizedBox(width: 12),
                          Expanded(
                            child: _buildResourceMetric(
                              'WPD',
                              '${r['wpd']} W/m²',
                              '风资源 ${r['windClass']}类',
                              _classColor(r['windClass'] as String),
                            ),
                          ),
                        ],
                      ),
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

  Widget _buildResourceMetric(
    String label,
    String value,
    String subtext,
    Color color,
  ) {
    return Container(
      padding: EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        border: Border.all(color: color.withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
          SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              color: Color(0xFF0F172A),
            ),
          ),
          SizedBox(height: 2),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              subtext,
              style: TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
