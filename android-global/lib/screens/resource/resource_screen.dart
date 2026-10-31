import 'package:flutter/material.dart';
import '../../widgets/photo_widgets.dart';
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
              asset: 'assets/images/eg_hero_solar.webp',
              title: 'Solar Assessment',
              description:
                  'Evaluate solar irradiance and PV potential at any location',
              onTap: () => Navigator.pushNamed(context, '/resource/solar'),
            ),
            const SizedBox(height: 16),
            _ResourceCard(
              asset: 'assets/images/eg_wind.webp',
              title: 'Wind Assessment',
              description:
                  'Assess wind resources and predict annual energy production',
              onTap: () => Navigator.pushNamed(context, '/resource/wind'),
            ),
            const SizedBox(height: 16),
            _ResourceCard(
              asset: 'assets/images/eg_sites.webp',
              title: 'Multi-site Comparison',
              description:
                  'Compare up to 10 sites with WGS84 coordinates using NASA POWER API — Class I–IV classification',
              onTap: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const CompareScreen())),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResourceCard extends StatelessWidget {
  final String asset;
  final String title;
  final String description;
  final VoidCallback onTap;

  const _ResourceCard({
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
        cta: 'Assess',
        onTap: onTap,
      );
}
