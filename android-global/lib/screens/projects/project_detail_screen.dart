import 'package:flutter/material.dart';

class ProjectDetailScreen extends StatelessWidget {
  final Map<String, dynamic>? project;
  const ProjectDetailScreen({super.key, this.project});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Project Details'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Container(
              height: 200,
              width: double.infinity,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFFEF3C7), Color(0xFFFCD34D)],
                ),
              ),
              child: const Center(
                child: Icon(Icons.wb_sunny, size: 80, color: Colors.white),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Delhi Solar Farm', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                  const SizedBox(height: 4),
                  const Text('New Delhi, India', style: TextStyle(fontSize: 14, color: Color(0xFF64748B))),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: const Color(0x3310B981), borderRadius: BorderRadius.circular(4)),
                    child: const Text('Active', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF10B981))),
                  ),
                  const SizedBox(height: 24),
                  const Text('Key Information', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                  const SizedBox(height: 12),
                  _DetailRow(label: 'Capacity', value: '100 MW'),
                  _DetailRow(label: 'Technology', value: 'Monocrystalline'),
                  _DetailRow(label: 'Annual Generation', value: '150 GWh'),
                  _DetailRow(label: 'Commissioned', value: 'Jan 2022'),
                  _DetailRow(label: 'Budget', value: '\$120 Million'),
                  const SizedBox(height: 24),
                  const Text('Financial Performance', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _StatCard(label: 'IRR', value: '14.7%', color: const Color(0xFF34D399)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _StatCard(label: 'NPV', value: '\$18.4M', color: const Color(0xFF60A5FA)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _StatCard(label: 'LCOE', value: '\$0.031/kWh', color: const Color(0xFFFCD34D)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _StatCard(label: 'Payback', value: '7.2 years', color: const Color(0xFFF87171)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {},
                      child: const Text('View Full Report'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: color.withOpacity(0.3))),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
        ],
      ),
    );
  }
}
