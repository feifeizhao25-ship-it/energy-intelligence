import 'package:flutter/material.dart';

class ResearchScreen extends StatefulWidget {
  const ResearchScreen({super.key});
  @override
  State<ResearchScreen> createState() => _ResearchScreenState();
}

class _ResearchScreenState extends State<ResearchScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final papers = [
      {
        'title': 'LCOE Trajectories for Solar and Wind in Emerging Markets',
        'authors': 'Smith et al.',
        'journal': 'Energy Policy',
        'year': '2024',
        'citations': '42',
        'tags': ['LCOE', 'Solar', 'Wind', 'Economics'],
      },
      {
        'title': 'Wind Resource Assessment Using Machine Learning',
        'authors': 'Kumar, Patel, Wong',
        'journal': 'Renewable Energy Review',
        'year': '2023',
        'citations': '28',
        'tags': ['Wind', 'ML', 'Resource'],
      },
      {
        'title': 'Optimal Cleaning Schedule for Solar Panels in Arid Regions',
        'authors': 'Al-Hashmi et al.',
        'journal': 'Solar Energy',
        'year': '2024',
        'citations': '15',
        'tags': ['Solar', 'O&M', 'Cleaning'],
      },
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Research Papers'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search papers...',
                prefixIcon: const Icon(Icons.search, size: 20),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),
            const SizedBox(height: 20),
            ...papers.map((paper) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6)],
                  ),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        paper['title'] as String,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${paper['authors']} • ${paper['journal']} (${paper['year']})',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.trending_up, size: 14, color: const Color(0xFF94A3B8)),
                          const SizedBox(width: 4),
                          Text('${paper['citations']} citations', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: (paper['tags'] as List<String>).map((tag) {
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(color: const Color(0xFFF0F9FF), borderRadius: BorderRadius.circular(4)),
                            child: Text(tag, style: const TextStyle(fontSize: 10, color: Color(0xFF0369A1))),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () {},
                          style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFF1D4ED8))),
                          child: const Text('AI Summarize'),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }
}
