import 'package:flutter/material.dart';
import 'anomaly_screen.dart';
import 'cleaning_screen.dart';

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
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _OpsCard(
              icon: Icons.favorite,
              title: 'Plant Health',
              description: 'Monitor overall plant performance and health score',
              color: const Color(0xFFF87171),
              onTap: () => Navigator.pushNamed(context, '/operations/health'),
            ),
            const SizedBox(height: 12),
            _OpsCard(
              icon: Icons.warning_outlined,
              title: 'Anomaly Detection',
              description: 'AI-powered generation anomaly detection and fault diagnosis',
              color: const Color(0xFFFCD34D),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AnomalyScreen())),
            ),
            const SizedBox(height: 12),
            _OpsCard(
              icon: Icons.build_circle_outlined,
              title: 'Equipment',
              description: 'Asset management and maintenance tracking',
              color: const Color(0xFF60A5FA),
              onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Coming soon'))),
            ),
            const SizedBox(height: 12),
            _OpsCard(
              icon: Icons.cleaning_services_outlined,
              title: 'Cleaning Optimizer',
              description: 'Optimal N* cleaning interval based on soiling rate and cost-benefit analysis',
              color: const Color(0xFF34D399),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CleaningScreen())),
            ),
          ],
        ),
      ),
    );
  }
}

class _OpsCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final Color color;
  final VoidCallback onTap;

  const _OpsCard({
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
