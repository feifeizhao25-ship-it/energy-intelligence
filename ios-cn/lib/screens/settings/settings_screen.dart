import 'package:flutter/material.dart';
import '../../config/region_config.dart';
import '../library/energy_library.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String? _account;

  @override
  void initState() {
    super.initState();
    _loadAccount();
  }

  Future<void> _loadAccount() async {
    try {
      final me = await ApiService.getMe();
      final value = me['name'] ?? me['full_name'] ?? me['email'] ?? me['phone'];
      if (mounted && value != null && '$value'.isNotEmpty) {
        setState(() => _account = '$value');
      }
    } catch (_) {
      // 读取失败时只显示“已登录账号”，不展示任何占位个人信息
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildUserProfile(context),
            const Divider(height: 24),
            const EnergyLibraryEntry(),
            _buildSettingItem(
              context,
              '关于${RegionConfig.appName}',
              Icons.info_outline,
              _showAbout,
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _showLogoutDialog,
                  icon: const Icon(Icons.logout),
                  label: const Text('退出登录'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: scheme.error,
                    side: BorderSide(color: scheme.error),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildUserProfile(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.person_outline,
              color: Theme.of(context).colorScheme.primary,
              size: 40,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            _account ?? '已登录账号',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingItem(
    BuildContext context,
    String title,
    IconData icon,
    VoidCallback onTap,
  ) {
    final scheme = Theme.of(context).colorScheme;
    return ListTile(
      leading: Icon(icon, color: scheme.onSurfaceVariant, size: 22),
      title: Text(title, style: const TextStyle(fontSize: 14)),
      trailing: Icon(Icons.chevron_right, color: scheme.outline),
      onTap: onTap,
    );
  }

  void _showAbout() {
    showAboutDialog(
      context: context,
      applicationName: RegionConfig.appName,
      applicationLegalese: '测算结果依赖输入参数与数据来源，仅供参考，不构成投资或工程决策依据。',
    );
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('退出登录'),
        content: const Text('确定要退出登录吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(dialogContext);
              await ApiService.logout();
              if (!mounted) return;
              Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
            },
            child: const Text('确定'),
          ),
        ],
      ),
    );
  }
}
