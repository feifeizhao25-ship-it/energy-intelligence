import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import 'wind_finance_screen.dart';
import 'storage_finance_screen.dart';

class FinanceScreen extends StatelessWidget {
  const FinanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Financial Modeling'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _FinanceCard(
              icon: Icons.wb_sunny,
              title: 'Solar PV Model',
              description: 'Calculate IRR, NPV, and LCOE for solar projects',
              color: const Color(0xFFFCD34D),
              onTap: () => Navigator.pushNamed(context, '/finance/solar'),
            ),
            const SizedBox(height: 12),
            _FinanceCard(
              icon: Icons.air,
              title: 'Wind Model',
              description: 'Financial analysis for wind energy projects with IRR, NPV, and LCOE',
              color: const Color(0xFFC084FC),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WindFinanceScreen())),
            ),
            const SizedBox(height: 12),
            _FinanceCard(
              icon: Icons.battery_charging_full,
              title: 'Storage Model',
              description: 'Battery BESS economics — peak/off-peak arbitrage and revenue analysis',
              color: const Color(0xFF34D399),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StorageFinanceScreen())),
            ),
          ],
        ),
      ),
    );
  }
}

class _FinanceCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final Color color;
  final VoidCallback onTap;

  const _FinanceCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6)],
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
                  const SizedBox(height: 4),
                  Text(description, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios, size: 16, color: Color(0xFFC7D2E0)),
          ],
        ),
      ),
    );
  }
}
