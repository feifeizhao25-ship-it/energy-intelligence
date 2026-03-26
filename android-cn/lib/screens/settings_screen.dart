import 'package:flutter/material.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _region = 'cn';
  String _language = 'zh-CN';
  bool _pushNotification = true;
  bool _emailNotification = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('设置'), backgroundColor: Colors.blue[700]),
      body: ListView(
        children: [
          // 区域设置
          _buildSection('区域与语言', [
            ListTile(
              leading: const Icon(Icons.public),
              title: const Text('当前区域'),
              trailing: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'cn', label: Text('🇨🇳 中国')),
                  ButtonSegment(value: 'global', label: Text('🌍 国际')),
                ],
                selected: {_region},
                onSelectionChanged: (s) => setState(() => _region = s.first),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.language),
              title: const Text('语言'),
              trailing: DropdownButton<String>(
                value: _language,
                items: const [
                  DropdownMenuItem(value: 'zh-CN', child: Text('简体中文')),
                  DropdownMenuItem(value: 'en-US', child: Text('English')),
                ],
                onChanged: (v) => setState(() => _language = v!),
              ),
            ),
          ]),
          
          // 通知设置
          _buildSection('通知设置', [
            SwitchListTile(
              secondary: const Icon(Icons.notifications),
              title: const Text('推送通知'),
              value: _pushNotification,
              onChanged: (v) => setState(() => _pushNotification = v),
            ),
            SwitchListTile(
              secondary: const Icon(Icons.email),
              title: const Text('邮件通知'),
              value: _emailNotification,
              onChanged: (v) => setState(() => _emailNotification = v),
            ),
          ]),
          
          // 账号
          _buildSection('账号', [
            ListTile(
              leading: const Icon(Icons.person),
              title: const Text('个人信息'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {},
            ),
            ListTile(
              leading: const Icon(Icons.lock),
              title: const Text('修改密码'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {},
            ),
          ]),
          
          // 关于
          _buildSection('关于', [
            const ListTile(
              leading: Icon(Icons.info),
              title: Text('版本'),
              trailing: Text('v1.0.0'),
            ),
            ListTile(
              leading: const Icon(Icons.description),
              title: const Text('用户协议'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {},
            ),
            ListTile(
              leading: const Icon(Icons.privacy_tip),
              title: const Text('隐私政策'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {},
            ),
          ]),
        ],
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Text(title, style: TextStyle(color: Colors.grey[600], fontWeight: FontWeight.bold)),
        ),
        ...children,
        const Divider(),
      ],
    );
  }
}
