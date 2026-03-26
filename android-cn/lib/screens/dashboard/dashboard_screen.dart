import 'package:flutter/material.dart';
import '../../models/user.dart';
import '../../models/project.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/metric_card.dart';
import '../../widgets/bar_chart.dart';
import '../../widgets/project_card.dart';
import '../resource/resource_screen.dart';
import '../finance/finance_screen.dart';
import '../operations/operations_screen.dart';
import '../ai_assistant/ai_assistant_screen.dart';
import '../projects/projects_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;
  User? _user;
  Map<String, dynamic> _metrics = {};
  List<Map<String, dynamic>> _alerts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final metrics = await ApiService.getDashboardMetrics();
      final alerts = await ApiService.getAlerts();
      setState(() {
        _metrics = metrics;
        _alerts = alerts;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('加载数据失败')),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      _buildHomeTab(),
      ProjectsScreen(),
      ResourceScreen(),
      FinanceScreen(),
      AiAssistantScreen(),
    ];

    return WillPopScope(
      onWillPop: () async => false,
      child: Scaffold(
        body: screens[_selectedIndex],
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) => setState(() => _selectedIndex = index),
          type: BottomNavigationBarType.fixed,
          items: [
            BottomNavigationBarItem(icon: Icon(Icons.home), label: '首页'),
            BottomNavigationBarItem(icon: Icon(Icons.folder), label: '项目'),
            BottomNavigationBarItem(icon: Icon(Icons.terrain), label: '资源'),
            BottomNavigationBarItem(icon: Icon(Icons.calculate), label: '计算'),
            BottomNavigationBarItem(icon: Icon(Icons.smart_toy), label: 'AI助手'),
          ],
        ),
      ),
    );
  }

  Widget _buildHomeTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 120,
            floating: false,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: AppTheme.primaryGradient(),
                ),
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '新能源智库',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          Stack(
                            children: [
                              IconButton(
                                icon: Icon(Icons.notifications_outlined, color: Colors.white),
                                onPressed: () {},
                              ),
                              if (_alerts.isNotEmpty)
                                Positioned(
                                  right: 8,
                                  top: 8,
                                  child: Container(
                                    width: 20,
                                    height: 20,
                                    decoration: BoxDecoration(
                                      color: Color(0xFFEF4444),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Center(
                                      child: Text(
                                        _alerts.length.toString(),
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                      SizedBox(height: 12),
                    ],
                  ),
                ),
              ),
              title: Text('首页'),
            ),
            actions: [
              Padding(
                padding: EdgeInsets.only(right: 16),
                child: Center(
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.person, color: AppTheme.primaryColor),
                  ),
                ),
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildWelcomeBanner(),
                  SizedBox(height: 24),
                  _buildMetricsGrid(),
                  SizedBox(height: 24),
                  _buildWeeklyChart(),
                  SizedBox(height: 24),
                  _buildAlertsSection(),
                  SizedBox(height: 24),
                  _buildProjectsSection(),
                  SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWelcomeBanner() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        decoration: BoxDecoration(
          gradient: AppTheme.primaryGradient(),
          borderRadius: BorderRadius.circular(16),
        ),
        padding: EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '欢迎回来，张伟',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildQuickActionChip('📊 查看报表', Color(0xFFFCD34D)),
                _buildQuickActionChip('⚡ 设置告警', Color(0xFF06B6D4)),
                _buildQuickActionChip('🔧 运维管理', Color(0xFF10B981)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionChip(String label, Color color) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          color: Colors.white,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildMetricsGrid() {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.1,
      children: [
        MetricCard(
          label: '今日发电',
          value: '${(_metrics['todayGeneration'] ?? 0) / 1000.0}',
          unit: 'MWh',
          trend: 'up',
          changePercent: _metrics['trendGeneration'] ?? 0,
          accentColor: Color(0xFFFCD34D),
          icon: Icons.wb_sunny,
        ),
        MetricCard(
          label: '今日收入',
          value: '¥${(_metrics['todayRevenue'] ?? 0) / 1000.0}',
          unit: '千元',
          trend: 'up',
          changePercent: _metrics['trendRevenue'] ?? 0,
          accentColor: Color(0xFF10B981),
          icon: Icons.trending_up,
        ),
        MetricCard(
          label: '碳减排',
          value: '${_metrics['carbonReduction'] ?? 0}',
          unit: '吨CO₂',
          trend: 'up',
          changePercent: _metrics['trendCarbon'] ?? 0,
          accentColor: Color(0xFF06B6D4),
          icon: Icons.eco,
        ),
        MetricCard(
          label: '电站健康',
          value: '${_metrics['healthScore'] ?? 0}',
          unit: '分',
          trend: 'up',
          changePercent: 2.3,
          accentColor: Color(0xFF3B82F6),
          icon: Icons.favorite,
        ),
      ],
    );
  }

  Widget _buildWeeklyChart() {
    final weeklyData = (_metrics['weeklyData'] ?? []) as List;
    final labels = weeklyData.map((d) => d['day'].toString().substring(2)).toList().cast<String>();
    final values = weeklyData.map((d) => (d['generation'] ?? 0.0) / 1000.0).toList().cast<double>();

    return BarChart(
      values: values,
      labels: labels,
      barColor: AppTheme.primaryColor,
      gradientStartColor: AppTheme.primaryColor,
      gradientEndColor: Color(0xFF06B6D4),
      title: '本周发电量趋势',
      yAxisLabel: '发电量(MWh)',
    );
  }

  Widget _buildAlertsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '告警提醒',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            TextButton(
              onPressed: () {},
              child: Text('全部', style: TextStyle(fontSize: 12)),
            ),
          ],
        ),
        SizedBox(height: 12),
        if (_alerts.isEmpty)
          Container(
            padding: EdgeInsets.symmetric(vertical: 24),
            alignment: Alignment.center,
            child: Text(
              '暂无告警',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
            ),
          )
        else
          ..._alerts.take(3).map((alert) {
            Color severityColor = alert['severity'] == 'critical'
                ? Color(0xFFEF4444)
                : alert['severity'] == 'warning'
                    ? Color(0xFFF59E0B)
                    : Color(0xFF3B82F6);

            return Container(
              margin: EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                border: Border(left: BorderSide(color: severityColor, width: 4)),
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              padding: EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          alert['project'] ?? '',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0F172A),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: severityColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          alert['status'] ?? '',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: severityColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 6),
                  Text(
                    alert['message'] ?? '',
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF475569),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            );
          }).toList(),
      ],
    );
  }

  Widget _buildProjectsSection() {
    return FutureBuilder(
      future: ApiService.getProjects(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return SizedBox(height: 200, child: Center(child: CircularProgressIndicator()));
        }

        final projects = snapshot.data ?? [];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '项目列表',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() => _selectedIndex = 1),
                  child: Text('更多', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
            SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: projects.map((project) {
                  return Container(
                    width: 280,
                    margin: EdgeInsets.only(right: 12),
                    child: ProjectCard(project: Project.fromJson(project as Map<String, dynamic>)),
                  );
                }).toList(),
              ),
            ),
          ],
        );
      },
    );
  }
}
