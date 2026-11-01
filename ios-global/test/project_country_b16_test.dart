// B16 (app): the user can choose a project's country when creating it and correct it later.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global_ios/screens/projects/create_project_screen.dart';
import 'package:energy_global_ios/screens/projects/project_detail_screen.dart';
import 'package:energy_global_ios/services/project_wire.dart';
import 'package:energy_global_ios/widgets/country_picker.dart';

void main() {
  Future<void> fill(WidgetTester t) async {
    await t.enterText(find.byKey(const Key('projectName')), 'Arizona Solar');
    await t.enterText(find.byKey(const Key('projectCapacity')), '20');
    await t.enterText(find.byKey(const Key('projectAddress')), 'Phoenix, Arizona');
    await t.enterText(find.byKey(const Key('projectLat')), '33.35');
    await t.enterText(find.byKey(const Key('projectLng')), '120.16');
  }

  testWidgets('create: the picked country is sent as location.country_code', (t) async {
    Map<String, dynamic>? body;
    await t.pumpWidget(MaterialApp(home: CreateProjectScreen(submit: (b) async { body = b; return b; })));
    await fill(t);
    await t.ensureVisible(find.byKey(const Key('countryField')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('countryField')));
    await t.pumpAndSettle();
    await t.ensureVisible(find.byKey(const Key('country_DE')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('country_DE')));
    await t.pumpAndSettle();
    expect(find.text('Germany'), findsWidgets);
    await t.ensureVisible(find.byKey(const Key('createProjectSubmit')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('createProjectSubmit')));
    await t.pumpAndSettle();
    expect((body!['location'] as Map)['country_code'], 'DE');
  });

  testWidgets('create: left on auto, no country_code is sent (the server recognises it from the address)', (t) async {
    Map<String, dynamic>? body;
    await t.pumpWidget(MaterialApp(home: CreateProjectScreen(submit: (b) async { body = b; return b; })));
    await fill(t);
    await t.ensureVisible(find.byKey(const Key('createProjectSubmit')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('createProjectSubmit')));
    await t.pumpAndSettle();
    expect((body!['location'] as Map).containsKey('country_code'), false);
  });

  test('wire: toWire only carries a non-empty, upper-cased country', () {
    final a = ProjectWire.toWire(name: 'n', technology: 'solar_pv', capacityMw: 1, latitude: 1, longitude: 1, countryCode: 'in');
    expect((a['location'] as Map)['country_code'], 'IN');
    final b = ProjectWire.toWire(name: 'n', technology: 'solar_pv', capacityMw: 1, latitude: 1, longitude: 1, countryCode: ' ');
    expect((b['location'] as Map).containsKey('country_code'), false);
  });

  testWidgets('detail: shows the country and lets the user correct it', (t) async {
    String? sent;
    await t.pumpWidget(MaterialApp(home: Scaffold(body: ProjectCountryRow(
      projectId: 'p1',
      initial: 'US',
      update: (id, code) async { sent = code; return {'data': {'country_code': code}}; },
    ))));
    expect(find.text('United States'), findsOneWidget);
    await t.tap(find.byKey(const Key('editCountry')));
    await t.pumpAndSettle();
    await t.ensureVisible(find.byKey(const Key('country_IN')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('country_IN')));
    await t.pumpAndSettle();
    expect(sent, 'IN');
    expect(find.text('India'), findsOneWidget);
  });

  testWidgets('detail: a failed save keeps the old value and says so', (t) async {
    await t.pumpWidget(MaterialApp(home: Scaffold(body: ProjectCountryRow(
      projectId: 'p1',
      initial: 'US',
      update: (id, code) async => throw Exception('offline'),
    ))));
    await t.tap(find.byKey(const Key('editCountry')));
    await t.pumpAndSettle();
    await t.ensureVisible(find.byKey(const Key('country_IN')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('country_IN')));
    await t.pumpAndSettle();
    expect(find.text('United States'), findsOneWidget);
    expect(find.text("Couldn't save. Please try again."), findsOneWidget);
  });

  testWidgets('detail screen carries the country row', (t) async {
    await t.pumpWidget(const MaterialApp(home: ProjectDetailScreen(project: {
      'id': 'p1', 'name': 'Arizona Solar Portfolio', 'technology': 'solar', 'capacity_mw': 100.0,
      'location': {'latitude': 33.4, 'longitude': -112.0, 'address': 'Phoenix, Arizona', 'country_code': 'US'}, 'status': 'draft',
    })));
    expect(find.byType(ProjectCountryRow), findsOneWidget);
    expect(find.text('United States'), findsOneWidget);
  });
}
