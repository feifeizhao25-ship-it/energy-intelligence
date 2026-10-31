import 'package:flutter/material.dart';
import '../../widgets/photo_widgets.dart';
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
              asset: 'assets/images/eg_panels.webp',
              title: 'Solar PV Model',
              description: 'Calculate IRR, NPV, and LCOE for solar projects',
              onTap: () => Navigator.pushNamed(context, '/finance/solar'),
            ),
            const SizedBox(height: 12),
            _FinanceCard(
              asset: 'assets/images/eg_city.webp',
              title: 'Wind Model',
              description:
                  'Financial analysis for wind energy projects with IRR, NPV, and LCOE',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const WindFinanceScreen()),
              ),
            ),
            const SizedBox(height: 12),
            _FinanceCard(
              asset: 'assets/images/eg_storage.webp',
              title: 'Storage Model',
              description:
                  'Battery BESS economics — peak/off-peak arbitrage and revenue analysis',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const StorageFinanceScreen()),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FinanceCard extends StatelessWidget {
  final String asset;
  final String title;
  final String description;
  final VoidCallback onTap;

  const _FinanceCard({
    required this.asset,
    required this.title,
    required this.description,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => EnPhotoCard(
        asset: asset,
        title: title,
        description: description,
        onTap: onTap,
      );
}
