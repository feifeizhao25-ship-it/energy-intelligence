import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/photo_widgets.dart';
import '../library/energy_library.dart';
import 'plan_usage_screen.dart';

/// Account screen. Every row does what it says: the profile is read from the server, export fetches the real
/// data copy, delete calls the account-deletion API and signing out clears the stored token.
class SettingsScreen extends StatefulWidget {
  final Future<Map<String, dynamic>> Function()? meLoader;
  final Future<Map<String, dynamic>> Function()? exporter;
  final Future<void> Function()? deleter;
  final Future<void> Function()? signOut;
  final UsageLoader? usageLoader;

  const SettingsScreen({super.key, this.meLoader, this.exporter, this.deleter, this.signOut, this.usageLoader});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String? _account;
  String? _detail;

  @override
  void initState() {
    super.initState();
    _loadAccount();
  }

  Future<void> _loadAccount() async {
    try {
      final me = await (widget.meLoader ?? ApiService.getMe)();
      final name = me['name'] ?? me['full_name'];
      final contact = me['email'] ?? me['phone'];
      final primary = (name != null && '$name'.isNotEmpty) ? '$name' : (contact != null ? '$contact' : null);
      if (mounted && primary != null && primary.isNotEmpty) {
        setState(() {
          _account = primary;
          _detail = (contact != null && '$contact' != primary) ? '$contact' : null;
        });
      }
    } catch (_) {
      // Keep the neutral "signed in" label; never show invented personal details.
    }
  }

  void _snack(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _export() async {
    try {
      final data = await (widget.exporter ?? ApiService.exportMyData)();
      if (!mounted) return;
      final counts = <String, int>{
        for (final e in data.entries)
          if (e.value is List) e.key: (e.value as List).length,
      };
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Your data copy'),
          content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Your data copy is ready, with the record counts below. Tap Copy to paste it somewhere safe.'),
            const SizedBox(height: 10),
            for (final e in counts.entries) Text('${e.key}: ${e.value}', style: const TextStyle(fontSize: 12)),
          ]),
          actions: [
            TextButton(
              key: const Key('exportCopy'),
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: const JsonEncoder.withIndent('  ').convert(data)));
                if (dialogContext.mounted) Navigator.pop(dialogContext);
                if (mounted) _snack('Copied to clipboard');
              },
              child: const Text('Copy'),
            ),
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Close')),
          ],
        ),
      );
    } catch (_) {
      if (mounted) _snack('Export failed. Please try again.');
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(context: context, builder: (_) => const _DeleteConfirmDialog());
    if (confirmed != true || !mounted) return;
    try {
      await (widget.deleter ?? ApiService.deleteMyAccount)();
      await (widget.signOut ?? ApiService.logout)();
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
    } catch (_) {
      if (mounted) _snack('Could not delete the account. Please try again.');
    }
  }

  Future<void> _confirmSignOut() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Sign out'),
        content: const Text('Sign out of this account?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          TextButton(key: const Key('signOutConfirm'), onPressed: () => Navigator.pop(dialogContext, true), child: const Text('OK')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await (widget.signOut ?? ApiService.logout)();
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: EnPhotoBanner(
                asset: 'assets/images/en_settings_blade.webp',
                title: 'Your account',
                subtitle: 'Plan, data and privacy',
                height: 130,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppTheme.primaryColor.withValues(alpha: 0.14),
                  child: Icon(Icons.person_outline, color: scheme.primary, size: 30),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_account ?? 'Signed in', key: const Key('accountName'), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                    if (_detail != null) Text(_detail!, style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant)),
                  ]),
                ),
              ]),
            ),
            _tile(Icons.workspace_premium_outlined, 'Plan & usage', 'See your plan, usage and reset dates', const Key('openPlanUsage'), () {
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => PlanUsageScreen(loader: widget.usageLoader)));
            }),
            _header('Data & privacy'),
            _tile(Icons.download_outlined, 'Export my data', 'Get a copy of your data in this app', const Key('exportData'), _export),
            _tile(Icons.delete_forever_outlined, 'Delete account', 'Permanently delete your account and data', const Key('deleteAccount'), _delete, danger: true),
            const EnergyLibraryEntry(),
            const Divider(height: 28),
            _tile(Icons.info_outline, 'About', null, const Key('about'), () {
              showAboutDialog(context: context, applicationName: 'Energy Intelligence', applicationLegalese: 'Results depend on the inputs and sources used. They are for reference only and are not investment or engineering advice.');
            }),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: OutlinedButton.icon(
                key: const Key('signOut'),
                onPressed: _confirmSignOut,
                icon: const Icon(Icons.logout),
                label: const Text('Sign out'),
                style: OutlinedButton.styleFrom(foregroundColor: scheme.error, side: BorderSide(color: scheme.error), minimumSize: const Size.fromHeight(46)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
        child: Semantics(header: true, child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurfaceVariant))),
      );

  Widget _tile(IconData icon, String title, String? subtitle, Key key, VoidCallback onTap, {bool danger = false}) {
    final scheme = Theme.of(context).colorScheme;
    final color = danger ? scheme.error : null;
    return ListTile(
      key: key,
      leading: Icon(icon, color: color ?? scheme.onSurfaceVariant),
      title: Text(title, style: TextStyle(fontSize: 15, color: color)),
      subtitle: subtitle == null ? null : Text(subtitle, style: const TextStyle(fontSize: 12)),
      trailing: Icon(Icons.chevron_right, color: scheme.outline),
      onTap: onTap,
    );
  }
}

/// Asks the person to type DELETE; owns its controller so it is disposed together with the dialog.
class _DeleteConfirmDialog extends StatefulWidget {
  const _DeleteConfirmDialog();

  @override
  State<_DeleteConfirmDialog> createState() => _DeleteConfirmDialogState();
}

class _DeleteConfirmDialogState extends State<_DeleteConfirmDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ready = _controller.text.trim() == 'DELETE';
    return AlertDialog(
      title: const Text('Delete account'),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('This immediately deletes your projects, models and reports and cannot be undone. Payment records the law requires us to keep are detached from your identity. Type DELETE to confirm.'),
          const SizedBox(height: 12),
          TextField(
            key: const Key('deleteConfirmField'),
            controller: _controller,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(hintText: 'Type DELETE', border: OutlineInputBorder()),
          ),
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
        TextButton(
          key: const Key('deleteConfirmButton'),
          onPressed: ready ? () => Navigator.pop(context, true) : null,
          child: Text('Delete', style: TextStyle(color: ready ? Colors.red : null)),
        ),
      ],
    );
  }
}
