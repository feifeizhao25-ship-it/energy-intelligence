import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class ResearchScreen extends StatefulWidget {
  const ResearchScreen({super.key});

  @override
  State<ResearchScreen> createState() => _ResearchScreenState();
}

class _ResearchScreenState extends State<ResearchScreen> {
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _papers = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadPapers();
  }

  void _loadPapers() async {
    setState(() => _isLoading = true);
    try {
      final papers = await ApiService.getPapers();
      setState(() {
        _papers = papers;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('研究文献')),
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: '搜索论文...',
                prefixIcon: Icon(Icons.search),
                suffixIcon: Icon(Icons.filter_alt),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onChanged: (value) async {
                setState(() => _isLoading = true);
                final results = await ApiService.getPapers(query: value);
                setState(() {
                  _papers = results;
                  _isLoading = false;
                });
              },
            ),
          ),
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator())
                : _papers.isEmpty
                    ? Center(child: Text('没有找到相关论文'))
                    : ListView.builder(
                        padding: EdgeInsets.all(16),
                        itemCount: _papers.length,
                        itemBuilder: (context, index) => _buildPaperCard(_papers[index]),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaperCard(Map<String, dynamic> paper) {
    return Card(
      elevation: 1,
      margin: EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              paper['title'] ?? '',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            SizedBox(height: 6),
            Text(
              (paper['authors'] ?? []).join(', '),
              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    '${paper['journal']} ${paper['year']}',
                    style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Icon(Icons.favorite_border, size: 16, color: Color(0xFFCBD5E1)),
              ],
            ),
            if ((paper['keywords'] ?? []).isNotEmpty) ...[
              SizedBox(height: 8),
              Wrap(
                spacing: 4,
                children: (paper['keywords'] ?? []).take(3).map<Widget>((tag) {
                  return Container(
                    padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(3),
                    ),
                    child: Text(tag, style: TextStyle(fontSize: 10, color: Color(0xFF475569))),
                  );
                }).toList(),
              ),
            ],
            SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('引用: ${paper['citations']}', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                TextButton(
                  onPressed: () {},
                  child: Text('AI摘要', style: TextStyle(fontSize: 11)),
                  style: TextButton.styleFrom(padding: EdgeInsets.zero),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
