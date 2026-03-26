import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('设置')),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildUserProfile(),
            Divider(height: 24, indent: 0),
            _buildSettingsSection(
              title: '账户',
              items: [
                _buildSettingItem('个人资料', Icons.person, () {}),
                _buildSettingItem('修改密码', Icons.lock, () {}),
                _buildSettingItem('通知设置', Icons.notifications, () {}),
              ],
            ),
            _buildSettingsSection(
              title: '订阅',
              items: [
                _buildSettingItem('当前方案：专业版', Icons.verified, () {}),
                _buildSettingItem('升级', Icons.upgrade, () {}),
                _buildSettingItem('账单记录', Icons.receipt, () {}),
              ],
            ),
            _buildSettingsSection(
              title: '偏好',
              items: [
                _buildSettingItem('语言', Icons.language, () {}),
                _buildSettingItem('时区', Icons.schedule, () {}),
                _buildSettingItem('主题', Icons.palette, () {}),
              ],
            ),
            _buildSettingsSection(
              title: '安全',
              items: [
                _buildSettingItem('双重认证', Icons.security, () {}),
                _buildSettingItem('登录设备', Icons.devices, () {}),
              ],
            ),
            _buildSettingsSection(
              title: '其他',
              items: [
                _buildSettingItem('关于', Icons.info, () {}),
                _buildSettingItem('帮助与反馈', Icons.help, () {}),
              ],
            ),
            Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _showLogoutDialog(),
                  icon: Icon(Icons.logout),
                  label: Text('退出登录'),
                  style: OutlinedButton.styleFrom(foregroundColor: Color(0xFFEF4444)),
                ),
              ),
            ),
            SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildUserProfile() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppTheme.primaryColor,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.person, color: Colors.white, size: 40),
          ),
          SizedBox(height: 12),
          Text(
            '张伟',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 4),
          Text(
            'wei.zhang@huaneng.com',
            style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          SizedBox(height: 8),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '专业版 • 华能新能源',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppTheme.primaryColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsSection({
    required String title,
    required List<Widget> items,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Text(
            title,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: AppTheme.primaryColor,
            ),
          ),
        ),
        ...items,
      ],
    );
  }

  Widget _buildSettingItem(String title, IconData icon, VoidCallback onTap) {
    return Material(
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Icon(icon, color: Color(0xFF94A3B8), size: 20),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
                ),
              ),
              Icon(Icons.chevron_right, color: Color(0xFFCBD5E1)),
            ],
          ),
        ),
      ),
    );
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('退出登录'),
        content: Text('确定要退出登录吗？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: Text('取消')),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.of(context).pushReplacementNamed('/login');
            },
            child: Text('确定'),
          ),
        ],
      ),
    );
  }
}
