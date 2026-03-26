import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../widgets/metric_card.dart';
import '../../widgets/bar_chart.dart';
import '../../services/mock_data.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            floating: true,
            backgroundColor: Colors.white,
            elevation: 0,
            title: Row(
              children: [
                const Icon(Icons.bolt, color: AppTheme.primary, size: 28),
                const SizedBox(width: 8),
                const Text('Energy Intelligence', style: TextStyle(color: Color(0xFF1E293B), fontSize: 18, fontWeight: FontWeight.bold)),
                const Spacer(),
                Stack(
                  children: [
                    IconButton(icon: const Icon(Icons.notifications_outlined, color: Color(0xFF64748B)), onPressed: () {}),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Key Metrics', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                  const SizedBox(height: 12),
                  GridView.count(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      MetricCard(title: 'Generation', value: '847 GWh', subtitle: 'YTD', icon: Icons.wb_sunny, color: const Color(0xFFFCD34D)),
                      MetricCard(title: 'Revenue', value: '\$46.6M', subtitle: 'YTD', icon: Icons.trending_up, color: const Color(0xFF34D399)),
                      MetricCard(title: 'Carbon Saved', value: '424 ktCO₂', subtitle: 'YTD', icon: Icons.eco, color: const Color(0xFF10B981)),
                      MetricCard(title: 'Health', value: '84%', subtitle: 'Fleet', icon: Icons.favorite, color: const Color(0xFFF87171)),
                    ],
                  ),
                  const SizedBox(height: 28),
                  const Text('Weekly Generation', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                  const SizedBox(height: 12),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: BarChart(data: MockData.weeklyGen, title: 'Weekly Generation (GWh)'),
                  ),
                  const SizedBox(height: 28),
                  const Text('Active Alerts', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                  const SizedBox(height: 12),
                  ...[
                    {'severity': 'critical', 'color': Colors.red, 'title': 'Equipment Fault', 'subtitle': 'Inverter A2 - Plant Delhi'},
                    {'severity': 'warning', 'color': Colors.amber, 'title': 'Performance Dip', 'subtitle': 'Generation 12% below forecast'},
                    {'severity': 'info', 'color': Colors.blue, 'title': 'Maintenance Due', 'subtitle': 'Cleaning scheduled for next week'},
                  ].map((alert) {
                    final color = alert['color'] as Color;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border(
                            left: BorderSide(color: color, width: 4),
                            right: const BorderSide(color: Color(0xFFE2E8F0)),
                            top: const BorderSide(color: Color(0xFFE2E8F0)),
                            bottom: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                        ),
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline, color: color, size: 20),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(alert['title'] as String, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
                                  Text(alert['subtitle'] as String, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                  const SizedBox(height: 28),
                  const Text('Quick Actions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                  const SizedBox(height: 12),
                  GridView.count(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      _ActionCard(icon: Icons.location_on, title: 'Assess Site', onTap: () => Navigator.pushNamed(context, '/resource/solar')),
                      _ActionCard(icon: Icons.calculate, title: 'Financial Model', onTap: () => Navigator.pushNamed(context, '/finance/solar')),
                      _ActionCard(icon: Icons.auto_awesome, title: 'AI Assistant', onTap: () => Navigator.pushNamed(context, '/ai')),
                      _ActionCard(icon: Icons.folder, title: 'View Projects', onTap: () => {}),
                    ],
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _ActionCard({required this.icon, required this.title, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFF0F9FF), Color(0xFFE0F2FE)]),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFBAE6FD)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 32, color: AppTheme.primary),
            const SizedBox(height: 8),
            Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
          ],
        ),
      ),
    );
  }
}
