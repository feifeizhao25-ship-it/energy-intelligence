import 'package:flutter/material.dart';
import '../../models/project.dart';
import '../../theme/app_theme.dart';
import '../resource/solar_resource_screen.dart';
import '../finance/solar_finance_screen.dart';
import '../operations/health_screen.dart';

class ProjectDetailScreen extends StatelessWidget {
  final Project project;

  const ProjectDetailScreen({required this.project, super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 180,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: _getProjectGradient(),
                ),
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(_getTypeIcon(), color: Colors.white, size: 28),
                      ),
                      SizedBox(height: 12),
                      Text(
                        project.name,
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildQuickActions(context),
                  SizedBox(height: 24),
                  _buildProjectInfo(),
                  SizedBox(height: 24),
                  _buildTimeline(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('快速操作', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
        SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          children: [
            _buildActionCard(
              title: '资源评估',
              icon: Icons.terrain,
              color: Color(0xFFFCD34D),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => SolarResourceScreen()),
              ),
            ),
            _buildActionCard(
              title: '收益计算',
              icon: Icons.calculate,
              color: Color(0xFF10B981),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => SolarFinanceScreen()),
              ),
            ),
            _buildActionCard(
              title: '运维诊断',
              icon: Icons.favorite,
              color: Color(0xFFEF4444),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => HealthScreen()),
              ),
            ),
            _buildActionCard(
              title: 'AI分析',
              icon: Icons.smart_toy,
              color: Color(0xFF3B82F6),
              onTap: () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('功能开发中'))),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildActionCard({
    required String title,
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
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, color: color, size: 22),
            ),
            SizedBox(height: 8),
            Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _buildProjectInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('项目信息', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
        SizedBox(height: 12),
        _buildInfoRow('类型', project.projectTypeLabel),
        _buildInfoRow('状态', project.statusLabel),
        _buildInfoRow('装机容量', '${project.capacityMw}MW'),
        _buildInfoRow('所在地', '${project.province}${project.address}'),
        _buildInfoRow('纬度', '${project.lat.toStringAsFixed(4)}°N'),
        _buildInfoRow('经度', '${project.lng.toStringAsFixed(4)}°E'),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }

  Widget _buildTimeline() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('项目历程', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
        SizedBox(height: 12),
        _buildTimelineItem(
          title: '项目创建',
          date: project.createdAt,
          icon: Icons.check_circle,
          color: Color(0xFF10B981),
        ),
        _buildTimelineItem(
          title: '资源评估',
          date: project.createdAt.add(Duration(days: 30)),
          icon: Icons.schedule,
          color: Color(0xFFFCD34D),
        ),
        _buildTimelineItem(
          title: '财务模型',
          date: project.createdAt.add(Duration(days: 60)),
          icon: Icons.schedule,
          color: Color(0xFF94A3B8),
        ),
      ],
    );
  }

  Widget _buildTimelineItem({
    required String title,
    required DateTime date,
    required IconData icon,
    required Color color,
  }) {
    return Padding(
      padding: EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
            child: Icon(icon, color: color, size: 20),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                Text(
                  '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
                  style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _getTypeIcon() {
    switch (project.projectType) {
      case 'solar_pv': return Icons.wb_sunny;
      case 'wind': return Icons.cloud;
      case 'storage': return Icons.battery_charging_full;
      default: return Icons.energy_savings_leaf;
    }
  }

  LinearGradient _getProjectGradient() {
    switch (project.projectType) {
      case 'solar_pv': return AppTheme.solarGradient();
      case 'wind': return AppTheme.windGradient();
      case 'storage': return LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)], begin: Alignment.topLeft, end: Alignment.bottomRight);
      default: return AppTheme.primaryGradient();
    }
  }
}
