import 'package:flutter/material.dart';

import '../../widgets/photo_widgets.dart';
import 'anomaly_screen.dart';
import 'cleaning_screen.dart';
import 'health_screen.dart';

/// 运维诊断入口：三个都是真实可用的工具，没有做好的不放在这里。
class OperationsScreen extends StatelessWidget {
  const OperationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('运维诊断')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const EnBanner(
            asset: 'assets/images/en_ops_hero.webp',
            caption: '让电站持续高效发电',
            chips: [(Icons.favorite, '健康'), (Icons.warning_amber_rounded, '故障'), (Icons.clean_hands, '清洗')],
            height: 168,
          ),
          const SizedBox(height: 16),
          EnPhotoCard(
            asset: 'assets/images/en_ops_health.webp',
            title: '电站健康诊断',
            subtitle: '设备状态与性能分析',
            icon: Icons.favorite,
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const HealthScreen())),
          ),
          const SizedBox(height: 14),
          EnPhotoCard(
            asset: 'assets/images/en_ops_anomaly.webp',
            title: '发电异常检测',
            subtitle: '异常波动分析与故障定位',
            icon: Icons.warning_amber_rounded,
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AnomalyScreen())),
          ),
          const SizedBox(height: 14),
          EnPhotoCard(
            asset: 'assets/images/en_ops_cleaning.webp',
            title: '清洗决策优化',
            subtitle: '最优清洗周期与成本分析',
            icon: Icons.clean_hands,
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CleaningScreen())),
          ),
        ],
      ),
    );
  }
}
