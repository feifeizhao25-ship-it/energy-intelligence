import 'package:flutter/material.dart';
import 'health_screen.dart';
import 'anomaly_screen.dart';
import 'cleaning_screen.dart';

class OperationsScreen extends StatelessWidget {
  const OperationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('运维诊断')),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('电站运维管理', style: Theme.of(context).textTheme.headlineSmall),
            SizedBox(height: 8),
            Text('全面监测与诊断，保障电站高效运营',
                style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
            SizedBox(height: 24),
            _buildModuleCard(
              context,
              title: '电站健康诊断',
              subtitle: '设备状态与性能分析',
              icon: Icons.favorite,
              color: Color(0xFFEF4444),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => HealthScreen()),
              ),
            ),
            SizedBox(height: 16),
            _buildModuleCard(
              context,
              title: '发电异常检测',
              subtitle: '异常波动分析与故障定位',
              icon: Icons.warning_amber_rounded,
              color: Color(0xFFF97316),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => AnomalyScreen()),
              ),
            ),
            SizedBox(height: 16),
            _buildModuleCard(
              context,
              title: '清洗决策优化',
              subtitle: '最优清洗周期与成本分析',
              icon: Icons.clean_hands,
              color: Color(0xFF06B6D4),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => CleaningScreen()),
              ),
            ),
            SizedBox(height: 16),
            _buildModuleCard(
              context,
              title: '数据分析',
              subtitle: '发电数据深度挖掘',
              icon: Icons.analytics,
              color: Color(0xFF10B981),
              onTap: () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('功能开发中'))),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModuleCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, color: color, size: 28),
              ),
              SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                    SizedBox(height: 4),
                    Text(subtitle, style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward, color: Color(0xFFCBD5E1)),
            ],
          ),
        ),
      ),
    );
  }
}
