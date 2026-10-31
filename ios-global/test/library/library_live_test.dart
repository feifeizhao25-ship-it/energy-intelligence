// Reference Library live updates + "For you": backend verdicts, reasons, new/updated markers, settings, offline fallback.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global_ios/screens/library/energy_library.dart';
import 'package:energy_global_ios/screens/library/library_live.dart';
import 'package:energy_global_ios/screens/library/reference_library_page.dart';

void main() {
  final raw = File(kEnergyLibraryAsset).readAsStringSync();
  final base = (jsonDecode(raw) as Map<String, dynamic>)['entries'] as List;

  Map<String, dynamic> entry(String id, {Map<String, dynamic>? display, String? badge}) {
    final e = Map<String, dynamic>.from(base.firstWhere((x) => x['id'] == id) as Map);
    e['review_status'] = 'Reviewed';
    e['display'] = display ?? {'state': 'current', 'banner': null, 'badges': [{'kind': 'verified', 'text': 'Checked 2 Nov 2026'}], 'change_note': null};
    if (badge != null) e['badge'] = badge;
    return e;
  }

  final updated = {
    'state': 'current',
    'banner': null,
    'badges': [
      {'kind': 'verified', 'text': 'Checked 4 Nov 2026'},
      {'kind': 'updated', 'text': 'Updated 4 Nov 2026'},
    ],
    'change_note': 'The 2025 figure was revised upward; use the latest release.',
  };
  final stale = {'state': 'source_changed', 'banner': 'The official source changed recently and is waiting for a human check. Until then rely on the original.', 'badges': [], 'change_note': null};

  final feedJson = {
    'enabled': true,
    'note': 'Picks use only your role, tech focus, region, project progress and what you have read.',
    'topics': [
      {'id': 'solar', 'name': 'Solar', 'followed': false, 'muted': false},
      {'id': 'storage', 'name': 'Storage & grid', 'followed': true, 'muted': false},
      {'id': 'market', 'name': 'Prices & markets', 'followed': false, 'muted': true},
    ],
    'items': [
      {'id': 'en-intl-002', 'title': 'US wholesale power prices', 'summary': 's', 'reason': 'You follow "Storage & grid"; this entry was updated', 'topic_name': 'Storage & grid', 'badge': 'updated', 'change_note': 'The 2025 figure was revised upward.', 'badges': [], 'source': {'publisher': 'EIA'}},
      {'id': 'en-intl-003', 'title': 'Ember: solar met 75% of global growth', 'summary': 's', 'reason': 'Your focus: storage', 'topic_name': 'Solar', 'badge': 'new', 'change_note': null, 'badges': [], 'source': {'publisher': 'Ember'}},
    ],
  };

  late List<Map<String, dynamic>> prefsCalls;
  late Map<String, dynamic> currentFeed;
  late List<String> openedIds;
  var visits = 0;

  LibraryLiveApi api({bool failEntries = false, bool failPrefs = false}) => LibraryLiveApi(
        entries: () async {
          if (failEntries) throw Exception('offline');
          return {
            'entries': [
              entry('en-intl-002', display: updated, badge: 'updated'),
              entry('en-intl-003', badge: 'new'),
              entry('en-intl-001', display: stale),
            ],
          };
        },
        feed: () async => currentFeed,
        setPrefs: (b) async {
          if (failPrefs) throw Exception('x');
          prefsCalls.add(b);
        },
        visit: () async => visits++,
        opened: (id) async => openedIds.add(id),
      );

  setUp(() {
    prefsCalls = [];
    openedIds = [];
    visits = 0;
    currentFeed = Map<String, dynamic>.from(jsonDecode(jsonEncode(feedJson)) as Map);
  });

  Future<void> pump(WidgetTester tester, LibraryLiveApi a) async {
    tester.view.physicalSize = const Size(900, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(home: ReferenceLibraryPage(strings: kEnergyLibraryStrings, assetPath: kEnergyLibraryAsset, live: a)));
    await tester.pumpAndSettle();
  }

  testWidgets('For you: each item says why, marks new and updated, and records one visit', (tester) async {
    await pump(tester, api());
    expect(find.byKey(const Key('library-foryou')), findsOneWidget);
    expect(find.text('For you'), findsOneWidget);
    expect(find.textContaining('Why you see this: You follow "Storage & grid"'), findsOneWidget);
    expect(find.textContaining('What changed: The 2025 figure was revised upward.'), findsOneWidget);
    expect(find.text('Updated'), findsWidgets);
    expect(find.text('New'), findsWidgets);
    expect(visits, 1);
  });

  testWidgets('Entries whose source changed show a banner; updated entries show the Updated badge', (tester) async {
    await pump(tester, api());
    expect(find.byKey(const Key('library-live-banner')), findsOneWidget);
    expect(find.textContaining('The official source changed recently'), findsOneWidget);
    expect(find.text('Updated 4 Nov 2026'), findsOneWidget);
  });

  testWidgets('Tapping a card opens the detail, records the read, and shows the change note', (tester) async {
    await pump(tester, api());
    await tester.tap(find.byKey(const Key('library-foryou-en-intl-002')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('library-detail')), findsOneWidget);
    expect(find.byKey(const Key('library-change-note')), findsOneWidget);
    expect(openedIds, ['en-intl-002']);
  });

  testWidgets('Settings: follow, hide, master switch; each tap is saved', (tester) async {
    await pump(tester, api());
    await tester.tap(find.byKey(const Key('library-settings')));
    await tester.pumpAndSettle();
    expect(find.text('Recommendation settings'), findsWidgets);
    await tester.tap(find.byKey(const Key('library-topic-solar')));
    await tester.pumpAndSettle();
    expect(prefsCalls.last, {'follow': ['solar']});
    await tester.tap(find.byKey(const Key('library-topic-storage')));
    await tester.pumpAndSettle();
    expect(prefsCalls.last, {'unfollow': ['storage']});
    await tester.longPress(find.byKey(const Key('library-topic-solar')));
    await tester.pumpAndSettle();
    expect(prefsCalls.last, {'mute': ['solar']});
    await tester.tap(find.byKey(const Key('library-pref-switch')));
    await tester.pumpAndSettle();
    expect(prefsCalls.last, {'enabled': false});
    expect(find.text('We are not choosing entries for you or recording what you read. You can turn this on again at any time.'), findsOneWidget);
  });

  testWidgets('A failed save shows a message and restores the switch', (tester) async {
    await pump(tester, api(failPrefs: true));
    await tester.tap(find.byKey(const Key('library-settings')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('library-pref-switch')));
    await tester.pumpAndSettle();
    expect(find.text('Could not save. Please try again.'), findsOneWidget);
    final sw = tester.widget<SwitchListTile>(find.byKey(const Key('library-pref-switch')));
    expect(sw.value, isTrue);
  });

  testWidgets('With personalisation off, no picks are shown, only one line and a way back', (tester) async {
    currentFeed['enabled'] = false;
    currentFeed['items'] = [];
    await pump(tester, api());
    expect(find.byKey(const Key('library-foryou')), findsNothing);
    expect(find.byKey(const Key('library-foryou-off')), findsOneWidget);
    expect(find.text('Personalised picks are off'), findsOneWidget);
  });

  testWidgets('Backend unreachable: falls back to the offline copy with a note, no picks', (tester) async {
    await pump(tester, api(failEntries: true));
    expect(find.byKey(const Key('library-offline-note')), findsOneWidget);
    expect(find.byKey(const Key('library-foryou')), findsNothing);
    expect(visits, 0);
  });
}
