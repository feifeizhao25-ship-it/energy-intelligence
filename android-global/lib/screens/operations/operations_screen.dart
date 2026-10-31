import 'package:flutter/material.dart';

import '../../widgets/photo_widgets.dart';
import 'anomaly_screen.dart';
import 'cleaning_screen.dart';

/// Operations hub: each tool opens a real screen. Tools that are not built yet are not listed.
class OperationsScreen extends StatelessWidget {
  const OperationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Operations'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const EnPhotoBanner(
            asset: 'assets/images/en_ops_hero.webp',
            title: 'Keep the plant producing',
            subtitle: 'Health, faults and cleaning in one place.',
            height: 168,
          ),
          const SizedBox(height: 16),
          EnPhotoCard(
            asset: 'assets/images/en_ops_health.webp',
            title: 'Plant health',
            description: 'Monitor overall plant performance and health score.',
            onTap: () => Navigator.pushNamed(context, '/operations/health'),
          ),
          const SizedBox(height: 14),
          EnPhotoCard(
            asset: 'assets/images/en_ops_anomaly.webp',
            title: 'Anomaly detection',
            description: 'Spot generation anomalies and get a fault diagnosis.',
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AnomalyScreen())),
          ),
          const SizedBox(height: 14),
          EnPhotoCard(
            asset: 'assets/images/en_ops_cleaning.webp',
            title: 'Cleaning optimizer',
            description: 'Find the best cleaning interval from soiling rate and cost.',
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CleaningScreen())),
          ),
        ],
      ),
    );
  }
}
