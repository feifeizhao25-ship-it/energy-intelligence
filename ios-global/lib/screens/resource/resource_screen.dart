import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import 'compare_screen.dart';

class ResourceScreen extends StatelessWidget {
  const ResourceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Resource Assessment'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _ResourceCard(
              icon: Icons.wb_sunny,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFFEF3C7), Color(0xFFFCD34D)],
              ),
              title: 'Solar Assessment',
              description: 'Evaluate solar irradiance and PV potential at any location',
              onTap: () => Navigator.pushNamed(context, '/resource/solar'),
            ),
            const SizedBox(height: 16),
            _ResourceCard(
              icon: Icons.air,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFDEBEFE), Color(0xFFC084FC)],
              ),
              title: 'Wind Assessment',
              description: 'Assess wind resources and predict annual energy production',
              onTap: () => Navigator.pushNamed(context, '/resource/wind'),
            ),
            const SizedBox(height: 16),
            _ResourceCard(
              icon: Icons.compare_arrows,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF7C3AED), Color(0xFF5B21B6)],
              ),
              title: 'Multi-site Comparison',
              description: 'Compare up to 10 sites with WGS84 coordinates using NASA POWER API — Class I–IV classification',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CompareScreen())),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResourceCard extends StatelessWidget {
  final IconData icon;
  final LinearGradient gradient;
  final String title;
  final String description;
  final VoidCallback onTap;

  const _ResourceCard({
    required this.icon,
    required this.gradient,
    required this.title,
    required this.description,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          gradient: gradient,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 8)],
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 40, color: Colors.white),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
            const SizedBox(height: 8),
            Text(description, style: const TextStyle(fontSize: 14, color: Colors.white70)),
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.bottomRight,
              child: ElevatedButton(
                onPressed: onTap,
                style: ElevatedButton.styleFrom(backgroundColor: Colors.white),
                child: const Text('Assess', style: TextStyle(color: Color(0xFF1E293B))),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
