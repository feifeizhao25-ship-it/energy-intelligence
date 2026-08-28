import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class AnomalyScreen extends StatefulWidget {
  const AnomalyScreen({super.key});

  @override
  State<AnomalyScreen> createState() => _AnomalyScreenState();
}

class _AnomalyScreenState extends State<AnomalyScreen> {
  bool _isLoading = true;
  String? _error;
  List<Map<String, dynamic>> _alerts = [];

  @override
  void initState() {
    super.initState();
    _loadAlerts();
  }

  Future<void> _loadAlerts() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final alerts = await ApiService.getAlerts();
      if (!mounted) return;
      setState(() => _alerts = alerts);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _alerts = [];
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _alerts = [];
        _error = '异常数据暂时无法读取，请稍后重试。';
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _text(Map<String, dynamic> alert, String key, String fallback) {
    final value = alert[key];
    return value is String && value.trim().isNotEmpty ? value : fallback;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('发电异常检测'),
        backgroundColor: const Color(0xFF1D4ED8),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: '刷新',
            icon: const Icon(Icons.refresh),
            onPressed: _isLoading ? null : _loadAlerts,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAlerts,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    _NoticeCard(
                      icon: Icons.sensors_off_outlined,
                      title: '暂无可核验的异常数据',
                      message: _error!,
                    )
                  else if (_alerts.isEmpty)
                    const _NoticeCard(
                      icon: Icons.check_circle_outline,
                      title: '当前没有异常记录',
                      message: '这里只展示服务器返回且有数据来源的告警，不会生成示例设备、随机指标或虚构损失。',
                    )
                  else ...[
                    Text(
                      '异常记录（${_alerts.length}）',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ..._alerts.map(
                      (alert) => Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ListTile(
                          leading: const Icon(
                            Icons.warning_amber_rounded,
                            color: Color(0xFFDC2626),
                          ),
                          title: Text(_text(alert, 'title', '未命名告警')),
                          subtitle: Text(_text(alert, 'message', '服务器未提供告警说明')),
                          trailing: Text(_text(alert, 'severity', '未知')),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(icon, size: 40, color: const Color(0xFF64748B)),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
