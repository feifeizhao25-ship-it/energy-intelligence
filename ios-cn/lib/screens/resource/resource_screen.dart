import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import 'solar_resource_screen.dart';
import 'wind_resource_screen.dart';
import 'compare_screen.dart';

class ResourceScreen extends StatelessWidget {
  const ResourceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('资源评估')),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '新能源资源潜力评估',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            SizedBox(height: 8),
            Text(
              '通过精准的资源评估为项目开发提供科学依据',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
            ),
            SizedBox(height: 24),
            _buildResourceCard(
              context,
              title: '光伏资源',
              subtitle: '太阳辐照评估与预测',
              icon: Icons.wb_sunny,
              gradient: AppTheme.solarGradient(),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => SolarResourceScreen()),
                );
              },
            ),
            SizedBox(height: 16),
            _buildResourceCard(
              context,
              title: '风资源',
              subtitle: '风速与风能密度评估',
              icon: Icons.cloud,
              gradient: AppTheme.windGradient(),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => WindResourceScreen()),
                );
              },
            ),
            SizedBox(height: 16),
            _buildResourceCard(
              context,
              title: '多站址对比',
              subtitle: '最多10个站址横向评估',
              icon: Icons.compare_arrows,
              gradient: LinearGradient(colors: [Color(0xFF7C3AED), Color(0xFF5B21B6)], begin: Alignment.topLeft, end: Alignment.bottomRight),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => CompareScreen()),
                );
              },
            ),
            SizedBox(height: 24),
            Text(
              '最近评估',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            SizedBox(height: 12),
            Card(
              child: Padding(
                padding: EdgeInsets.all(12),
                child: Row(
                  children: [
                    Icon(Icons.assessment, color: AppTheme.primaryColor),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('山东德州100MW光伏', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Text('GHI: 1456.8 kWh/m²/year', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right, color: Color(0xFFCBD5E1)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResourceCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required LinearGradient gradient,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            gradient: gradient,
            borderRadius: BorderRadius.circular(16),
          ),
          padding: EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: Colors.white, size: 32),
              ),
              SizedBox(height: 16),
              Text(
                title,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.white.withOpacity(0.8),
                ),
              ),
              SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '开始评估',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  Icon(Icons.arrow_forward, color: Colors.white, size: 20),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
