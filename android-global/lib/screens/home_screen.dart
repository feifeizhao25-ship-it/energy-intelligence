import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Energy Intelligence'),
        backgroundColor: Colors.blue[700],
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.wb_sunny, color: Colors.orange[700], size: 40),
                        const SizedBox(width: 12),
                        const Text(
                          'Welcome Back',
                          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text('Global Energy Intelligence Platform'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            
            // Quick Stats
            const Text('Quick Stats', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _buildStatCard('Projects', '12', Icons.folder, Colors.blue)),
                Expanded(child: _buildStatCard('Plants', '8', Icons.solar_power, Colors.orange)),
                Expanded(child: _buildStatCard('Alerts', '3', Icons.warning, Colors.red)),
              ],
            ),
            const SizedBox(height: 16),
            
            // Quick Actions
            const Text('Quick Actions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            _buildActionTile(context, Icons.add_circle, 'New Project', 'Create a new energy project'),
            _buildActionTile(context, Icons.analytics, 'Analysis', 'Run project analysis'),
            _buildActionTile(context, Icons.description, 'Generate Report', 'Create feasibility report'),
            _buildActionTile(context, Icons.search, 'Search Papers', 'Find research papers'),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, color: color, size: 32),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            Text(title, style: const TextStyle(color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  Widget _buildActionTile(BuildContext context, IconData icon, String title, String subtitle) {
    return ListTile(
      leading: CircleAvatar(child: Icon(icon)),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right),
      onTap: () {},
    );
  }
}
