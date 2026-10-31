import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global/models/project.dart';
import 'package:energy_global/screens/projects/create_project_screen.dart';
import 'package:energy_global/screens/projects/projects_screen.dart';
import 'package:energy_global/services/api_service.dart';
import 'package:energy_global/services/project_wire.dart';

void main() {
  Future<void> fill(WidgetTester t, {String name = 'Texas Solar One', String cap = '20', String lat = '30.27', String lng = '-97.74'}) async {
    await t.enterText(find.byKey(const Key('projectName')), name);
    await t.enterText(find.byKey(const Key('projectCapacity')), cap);
    await t.enterText(find.byKey(const Key('projectAddress')), 'Austin, Texas');
    await t.enterText(find.byKey(const Key('projectLat')), lat);
    await t.enterText(find.byKey(const Key('projectLng')), lng);
  }

  testWidgets('empty form shows what is missing and sends nothing', (t) async {
    var sent = 0;
    await t.pumpWidget(MaterialApp(home: CreateProjectScreen(submit: (b) async { sent++; return b; })));
    await t.tap(find.byKey(const Key('createProjectSubmit')));
    await t.pumpAndSettle();
    expect(find.text('Enter the project name'), findsOneWidget);
    expect(find.text('Enter a capacity greater than 0'), findsOneWidget);
    expect(find.textContaining('Enter the latitude'), findsOneWidget);
    expect(sent, 0);
  });

  testWidgets('out-of-range coordinates are rejected before the server sees them', (t) async {
    await t.pumpWidget(MaterialApp(home: CreateProjectScreen(submit: (b) async => b)));
    await fill(t, lat: '95');
    await t.tap(find.byKey(const Key('createProjectSubmit')));
    await t.pumpAndSettle();
    expect(find.textContaining('The latitude must be between'), findsOneWidget);
  });

  testWidgets('a valid form sends the server contract and returns the created project', (t) async {
    Map<String, dynamic>? body;
    Map<String, dynamic>? result;
    await t.pumpWidget(MaterialApp(home: Builder(builder: (c) => Scaffold(
      body: TextButton(
        onPressed: () async => result = await Navigator.of(c).push<Map<String, dynamic>>(MaterialPageRoute(
            builder: (_) => CreateProjectScreen(submit: (b) async { body = b; return {'id': 'p1', ...b}; }))),
        child: const Text('open'))))));
    await t.tap(find.text('open'));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('type_wind')));
    await fill(t);
    await t.ensureVisible(find.byKey(const Key('createProjectSubmit')));
    await t.tap(find.byKey(const Key('createProjectSubmit')));
    await t.pumpAndSettle();
    expect(body, {
      'name': 'Texas Solar One',
      'technology': 'wind',
      'capacity_kw': 20000.0,
      'location': {'latitude': 30.27, 'longitude': -97.74, 'address': 'Austin, Texas'},
    });
    expect(result?['id'], 'p1');
    expect(find.byType(CreateProjectScreen), findsNothing);
  });

  testWidgets('a plan-limit error from the server is shown on the form', (t) async {
    await t.pumpWidget(MaterialApp(home: CreateProjectScreen(
        submit: (b) async => throw ApiException(429, 'Your plan includes 1 project. Upgrade your plan to add more.'))));
    await fill(t);
    await t.ensureVisible(find.byKey(const Key('createProjectSubmit')));
    await t.tap(find.byKey(const Key('createProjectSubmit')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('createProjectError')), findsOneWidget);
    expect(find.textContaining('Upgrade your plan'), findsOneWidget);
    expect(find.byType(CreateProjectScreen), findsOneWidget);
  });

  testWidgets('the empty Projects page offers to create the first project', (t) async {
    await t.pumpWidget(MaterialApp(home: ProjectsScreen(loader: () async => [])));
    await t.pumpAndSettle();
    expect(find.text('New project'), findsWidgets);
    await t.tap(find.byKey(const Key('createProjectEmptyCta')));
    await t.pumpAndSettle();
    expect(find.byType(CreateProjectScreen), findsOneWidget);
  });

  test('a project saved on the server is read back with its real type, size and place', () {
    final flat = ProjectWire.fromWire({
      'id': 'p1', 'name': 'Texas Solar One', 'technology': 'solar_pv', 'capacity_kw': 20000.0, 'status': 'draft',
      'location': {'latitude': 30.27, 'longitude': -97.74, 'address': 'Austin, Texas'},
      'created_at': '2026-10-31T10:00:00+00:00',
    });
    final p = Project.fromJson(flat);
    expect(p.projectType, 'solar_pv');
    expect(p.capacityMw, 20);
    expect(p.lat, 30.27);
    expect(p.address, 'Austin, Texas');
    expect(p.statusLabel, 'Draft');
    expect(ProjectWire.projectTypeOf('crystalline'), 'solar_pv');
    expect(ProjectWire.projectTypeOf('Offshore Wind'), 'wind');
  });
}
