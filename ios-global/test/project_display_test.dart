import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global_ios/screens/projects/project_detail_screen.dart';
import 'package:energy_global_ios/utils/project_display.dart';

void main() {
  group('projectLocationText', () {
    test('server object -> its address, never raw map text', () {
      expect(projectLocationText({'latitude': 31, 'longitude': -100, 'address': 'West Texas'}), 'West Texas');
    });
    test('object without address -> readable coordinates', () {
      expect(projectLocationText({'latitude': 31.0, 'longitude': -100.0, 'address': null}), '31.00°N, 100.00°W');
      expect(projectLocationText({'latitude': -33.87, 'longitude': 151.2}), '33.87°S, 151.20°E');
    });
    test('map that was already turned into text (the old bug)', () {
      expect(projectLocationText('{latitude: 31, longitude: -100, address: West Texas}'), 'West Texas');
      expect(projectLocationText('{latitude: 31, longitude: -100, address: null}'), '31.00°N, 100.00°W');
      expect(projectLocationText('{"latitude": 31, "longitude": -100, "address": "Austin, TX"}'), 'Austin, TX');
    });
    test('plain text stays; empty/unusable -> null', () {
      expect(projectLocationText('Phoenix, Arizona'), 'Phoenix, Arizona');
      expect(projectLocationText(null), isNull);
      expect(projectLocationText('  '), isNull);
      expect(projectLocationText({}), isNull);
    });
  });

  group('projectCapacityText', () {
    test('capacity_kw from the API is shown in MW', () {
      expect(projectCapacityText({'capacity_kw': 100000.0}), '100 MW');
      expect(projectCapacityText({'capacity_kw': 2500}), '2.5 MW');
    });
    test('capacity_mw still works; zero/missing -> null', () {
      expect(projectCapacityText({'capacity_mw': 50.0}), '50 MW');
      expect(projectCapacityText({'capacity_kw': 0}), isNull);
      expect(projectCapacityText({}), isNull);
    });
  });

  testWidgets('detail screen shows the address and capacity from the real API shape', (t) async {
    const project = {
      'id': 'p1',
      'name': 'Permian Solar',
      'technology': 'solar',
      'capacity_kw': 100000.0,
      'location': {'latitude': 31, 'longitude': -100, 'address': 'West Texas'},
      'status': 'draft',
    };
    await t.pumpWidget(const MaterialApp(home: ProjectDetailScreen(project: project)));
    expect(find.text('West Texas'), findsWidgets);
    expect(find.text('100 MW'), findsOneWidget);
    expect(find.textContaining('latitude'), findsNothing);
    expect(find.textContaining('{'), findsNothing);
  });
}
