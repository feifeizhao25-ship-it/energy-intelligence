import 'package:flutter/material.dart';
import '../services/api_service.dart';

class PapersScreen extends StatefulWidget {
  const PapersScreen({super.key});

  @override
  State<PapersScreen> createState() => _PapersScreenState();
}

class _PapersScreenState extends State<PapersScreen> {
  List<dynamic> _papers = [];
  bool _loading = true;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final papers = await ApiService.getPapers();
    setState(() {
      _papers = papers;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('论文库'), backgroundColor: Colors.blue[700]),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: '搜索论文...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.grey[100],
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _papers.length,
                    itemBuilder: (context, index) {
                      final paper = _papers[index];
                      return _buildPaperCard(paper);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaperCard(Map<String, dynamic> paper) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(paper['title'], style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text((paper['authors'] as List).join(', '), style: TextStyle(color: Colors.grey[600])),
            const SizedBox(height: 8),
            Text(paper['abstract'], maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.grey[700])),
            const SizedBox(height: 12),
            Row(
              children: [
                Chip(label: Text('${paper['year']}')),
                const SizedBox(width: 8),
                ...(paper['tags'] as List).take(2).map((tag) => Chip(label: Text('$tag'), backgroundColor: Colors.blue[50])),
                const Spacer(),
                IconButton(icon: const Icon(Icons.download), onPressed: () {}),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
