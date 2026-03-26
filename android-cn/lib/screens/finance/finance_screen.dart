import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import 'solar_finance_screen.dart';
import 'wind_finance_screen.dart';
import 'storage_finance_screen.dart';

class FinanceScreen extends StatelessWidget {
  const FinanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('财务计算')),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '新能源项目财务分析',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            SizedBox(height: 8),
            Text(
              '全面计算项目财务指标，支持多种能源类型',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
            ),
            SizedBox(height: 24),
            _buildFinanceCard(
              context,
              title: '光伏电站',
              subtitle: 'PV项目财务分析',
              icon: Icons.wb_sunny,
              color: Color(0xFFFCD34D),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => SolarFinanceScreen()),
                );
              },
            ),
            SizedBox(height: 16),
            _buildFinanceCard(
              context,
              title: '风电项目',
              subtitle: '风电场财务计算',
              icon: Icons.cloud,
              color: Color(0xFF06B6D4),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => WindFinanceScreen())),
            ),
            SizedBox(height: 16),
            _buildFinanceCard(
              context,
              title: '储能系统',
              subtitle: '储能项目成本分析',
              icon: Icons.battery_charging_full,
              color: Color(0xFF8B5CF6),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => StorageFinanceScreen())),
            ),
            SizedBox(height: 16),
            _buildFinanceCard(
              context,
              title: '方案对比',
              subtitle: '多个方案对比分析',
              icon: Icons.compare_arrows,
              color: Color(0xFF3B82F6),
              onTap: () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('功能开发中'))),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFinanceCard(
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
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 28),
              ),
              SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF64748B),
                      ),
                    ),
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
