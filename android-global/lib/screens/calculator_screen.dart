import 'package:flutter/material.dart';

class CalculatorScreen extends StatefulWidget {
  const CalculatorScreen({super.key});

  @override
  State<CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends State<CalculatorScreen> {
  String _selectedType = 'Solar';
  final _capacityController = TextEditingController();
  final _locationController = TextEditingController();
  
  String _result = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ROI Calculator')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Project Type', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'Solar', label: Text('Solar')),
                ButtonSegment(value: 'Wind', label: Text('Wind')),
                ButtonSegment(value: 'Storage', label: Text('Storage')),
              ],
              selected: {_selectedType},
              onSelectionChanged: (value) => setState(() => _selectedType = value.first),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _capacityController,
              decoration: const InputDecoration(
                labelText: 'Capacity (kW)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.electric_bolt),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _locationController,
              decoration: const InputDecoration(
                labelText: 'Location',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.location_on),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _calculate,
                style: ElevatedButton.styleFrom(backgroundColor: Colors.blue[700], foregroundColor: Colors.white),
                child: const Text('Calculate ROI'),
              ),
            ),
            if (_result.isNotEmpty) ...[
              const SizedBox(height: 16),
              Card(
                color: Colors.blue[50],
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Results', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      Text(_result, style: const TextStyle(fontSize: 16)),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _calculate() {
    final capacity = double.tryParse(_capacityController.text) ?? 0;
    if (capacity <= 0) {
      setState(() => _result = 'Please enter a valid capacity');
      return;
    }
    
    // Simple calculation
    final capex = capacity * 3.5; // $3.5/W
    final annualGeneration = capacity * 1400; // kWh
    final annualRevenue = annualGeneration * 0.12; // $0.12/kWh
    final annualProfit = annualRevenue * 0.7;
    final irr = (annualProfit / capex) * 100;
    
    setState(() {
      _result = '''
Capacity: ${capacity}kW
Investment: \$${capex.toStringAsFixed(0)}
Annual Generation: ${annualGeneration}kWh
Annual Revenue: \$${annualRevenue.toStringAsFixed(0)}
IRR: ${irr.toStringAsFixed(1)}%
''';
    });
  }
}
