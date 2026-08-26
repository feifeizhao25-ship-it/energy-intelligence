import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../resource/resource_screen.dart';
import '../finance/finance_screen.dart';
import '../ai_assistant/ai_assistant_screen.dart';
import '../projects/projects_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;
  List<Map<String, dynamic>> _projects = const [];
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final projects = await ApiService.getProjects();
      if (mounted) setState(() => _projects = projects);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = '首页数据暂时不可用');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  double get _capacity => _projects.fold(0, (sum, project) {
    final value =
        project['capacity_mw'] ?? project['capacityMw'] ?? project['capacity'];
    return sum + (value is num ? value.toDouble() : 0);
  });

  @override
  Widget build(BuildContext context) {
    final screens = [
      _home(),
      const ProjectsScreen(),
      const ResourceScreen(),
      const FinanceScreen(),
      const AiAssistantScreen(),
    ];
    return PopScope(
      canPop: false,
      child: Scaffold(
        body: IndexedStack(index: _selectedIndex, children: screens),
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) => setState(() => _selectedIndex = index),
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              label: '首页',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.folder_outlined),
              label: '项目',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.terrain_outlined),
              label: '资源',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.calculate_outlined),
              label: '计算',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.smart_toy_outlined),
              label: 'AI助手',
            ),
          ],
        ),
      ),
    );
  }

  Widget _home() => RefreshIndicator(
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 52, 16, 24),
      children: [
        const Row(
          children: [
            Icon(Icons.bolt, color: AppTheme.primaryColor, size: 30),
            SizedBox(width: 8),
            Text(
              '新能源智库',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          '仅展示当前账号中经过验证的项目数据',
          style: TextStyle(color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 20),
        if (_loading)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(48),
              child: CircularProgressIndicator(),
            ),
          )
        else if (_error != null)
          _Status(
            icon: Icons.cloud_off_outlined,
            title: '数据加载失败',
            detail: _error!,
            action: _load,
          )
        else ...[
          Row(
            children: [
              Expanded(
                child: _Metric(
                  title: '项目数量',
                  value: _projects.length.toString(),
                  icon: Icons.folder_outlined,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _Metric(
                  title: '装机容量',
                  value: _capacity == 0
                      ? '未填写'
                      : '${_capacity.toStringAsFixed(1)} MW',
                  icon: Icons.bolt,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const _Status(
            icon: Icons.monitor_heart_outlined,
            title: '运行指标待接入',
            detail: '接入经过授权的 SCADA/IoT 数据后，才会展示发电量、收益、碳减排、健康度和告警。',
          ),
        ],
      ],
    ),
  );
}

class _Metric extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  const _Metric({required this.title, required this.value, required this.icon});
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppTheme.primaryColor),
          const SizedBox(height: 16),
          Text(
            value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          ),
          Text(title, style: const TextStyle(color: Color(0xFF64748B))),
        ],
      ),
    ),
  );
}

class _Status extends StatelessWidget {
  final IconData icon;
  final String title;
  final String detail;
  final Future<void> Function()? action;
  const _Status({
    required this.icon,
    required this.title,
    required this.detail,
    this.action,
  });
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xFF64748B)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(detail, style: const TextStyle(color: Color(0xFF64748B))),
                if (action != null)
                  TextButton(onPressed: action, child: const Text('重试')),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
