// 新能源智库 资料库「保持更新 + 为你推荐」：后端结论的展示、推荐理由、新/更新标记、设置和离线退回。
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/screens/library/energy_library.dart';
import 'package:energy_app/screens/library/library_live.dart';
import 'package:energy_app/screens/library/reference_library_page.dart';

void main() {
  final raw = File(kEnergyLibraryAsset).readAsStringSync();
  final base = (jsonDecode(raw) as Map<String, dynamic>)['entries'] as List;

  Map<String, dynamic> entry(String id, {Map<String, dynamic>? display, String? badge}) {
    final e = Map<String, dynamic>.from(base.firstWhere((x) => x['id'] == id) as Map);
    e['review_status'] = '已审核';
    e['display'] = display ?? {'state': 'current', 'banner': null, 'badges': [{'kind': 'verified', 'text': '2026-11-02 核对'}], 'change_note': null};
    if (badge != null) e['badge'] = badge;
    return e;
  }

  final updated = {
    'state': 'current',
    'banner': null,
    'badges': [
      {'kind': 'verified', 'text': '2026-11-04 核对'},
      {'kind': 'updated', 'text': '更新于 2026-11-04'},
    ],
    'change_note': '第三条的适用范围说明有调整，请以最新版为准。',
  };
  final stale = {'state': 'source_changed', 'banner': '官方原文近期有变动，正在等待人工核对，核对完成前请以官方原文为准。', 'badges': [], 'change_note': null};

  final feedJson = {
    'enabled': true,
    'note': '推荐只用你自己填写的角色、关注的技术和主题、项目进度，以及读过的内容；国内版资料都是全国性文件，不按省份推荐。',
    'topics': [
      {'id': 'solar', 'name': '光伏', 'followed': false, 'muted': false},
      {'id': 'storage', 'name': '储能与电网', 'followed': true, 'muted': false},
      {'id': 'market', 'name': '电价与市场', 'followed': false, 'muted': true},
    ],
    'items': [
      {'id': 'en-lib-004', 'title': '新型电力系统与储能', 'summary': 's', 'reason': '你关注了「储能与电网」；资料有更新', 'topic_name': '储能与电网', 'badge': 'updated', 'change_note': '第三条的适用范围说明有调整。', 'badges': [], 'source': {'publisher': '国家能源局'}},
      {'id': 'en-lib-005', 'title': '绿证、分时电价与需求响应', 'summary': 's', 'reason': '你关注的技术：储能', 'topic_name': '电价与市场', 'badge': 'new', 'change_note': null, 'badges': [], 'source': {'publisher': '官方'}},
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
              entry('en-lib-004', display: updated, badge: 'updated'),
              entry('en-lib-005', badge: 'new'),
              entry('en-lib-003', display: stale),
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

  testWidgets('为你推荐：每条写明理由，标出新增和更新，并记一次来访', (tester) async {
    await pump(tester, api());
    expect(find.byKey(const Key('library-foryou')), findsOneWidget);
    expect(find.text('为你推荐'), findsOneWidget);
    expect(find.textContaining('为什么推荐：你关注了「储能与电网」'), findsOneWidget);
    expect(find.textContaining('更新说明：第三条的适用范围说明有调整。'), findsOneWidget);
    expect(find.text('已更新'), findsWidgets);
    expect(find.text('新'), findsWidgets);
    expect(visits, 1);
  });

  testWidgets('来源有变动的条目带横幅；已更新的条目显示“更新于”', (tester) async {
    await pump(tester, api());
    expect(find.byKey(const Key('library-live-banner')), findsOneWidget);
    expect(find.textContaining('官方原文近期有变动'), findsOneWidget);
    expect(find.text('更新于 2026-11-04'), findsOneWidget);
  });

  testWidgets('点推荐卡片进入详情并记录已读；详情里有更新说明', (tester) async {
    await pump(tester, api());
    await tester.tap(find.byKey(const Key('library-foryou-en-lib-004')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('library-detail')), findsOneWidget);
    expect(find.byKey(const Key('library-change-note')), findsOneWidget);
    expect(openedIds, ['en-lib-004']);
  });

  testWidgets('设置：关注、不再推荐、总开关，每次都保存；失败会提示并恢复', (tester) async {
    await pump(tester, api());
    await tester.tap(find.byKey(const Key('library-settings')));
    await tester.pumpAndSettle();
    expect(find.text('推荐设置'), findsWidgets);
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
    expect(find.text('现在不会为你挑选资料，也不会记录你读过什么。随时可以重新打开。'), findsOneWidget);
  });

  testWidgets('设置保存失败：提示并恢复原状', (tester) async {
    await pump(tester, api(failPrefs: true));
    await tester.tap(find.byKey(const Key('library-settings')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('library-pref-switch')));
    await tester.pumpAndSettle();
    expect(find.text('没有保存成功，请稍后再试'), findsOneWidget);
    final sw = tester.widget<SwitchListTile>(find.byKey(const Key('library-pref-switch')));
    expect(sw.value, isTrue);
  });

  testWidgets('关闭个性化后不显示推荐，只留一行说明和入口', (tester) async {
    currentFeed['enabled'] = false;
    currentFeed['items'] = [];
    await pump(tester, api());
    expect(find.byKey(const Key('library-foryou')), findsNothing);
    expect(find.byKey(const Key('library-foryou-off')), findsOneWidget);
    expect(find.text('个性化推荐已关闭'), findsOneWidget);
  });

  testWidgets('后端连不上：退回离线资料并说明，不显示推荐', (tester) async {
    await pump(tester, api(failEntries: true));
    expect(find.byKey(const Key('library-offline-note')), findsOneWidget);
    expect(find.byKey(const Key('library-foryou')), findsNothing);
    expect(visits, 0);
  });
}
