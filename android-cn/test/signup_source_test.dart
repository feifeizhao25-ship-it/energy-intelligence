import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/screens/auth/login_screen.dart';
import 'package:energy_app/theme/app_theme.dart';
import 'package:energy_app/widgets/signup_source_picker.dart';

const _labels = ['小红书', '抖音', '视频号', '公众号', '知乎', '哔哩哔哩', '搜索', '朋友推荐', '其他'];
const _codes = ['xiaohongshu', 'douyin', 'wechat_channels', 'wechat_oa', 'zhihu', 'bilibili', 'search', 'friend', 'other'];

Map<String, dynamic> _enabled() => {
      'enabled': true,
      'question': '从哪知道我们',
      'options': [for (var i = 0; i < _codes.length; i++) {'code': _codes[i], 'label': _labels[i]}],
      'skippable': true,
    };

Future<void> _pump(WidgetTester tester, Future<Object?> Function()? loader) async {
  tester.view.physicalSize = const Size(390, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(MaterialApp(theme: AppTheme.buildTheme(), home: LoginScreen(signupSourceLoader: loader)));
  await tester.pumpAndSettle();
  await tester.tap(find.text('手机验证码'));
  await tester.pumpAndSettle();
}

void main() {
  test('开关关闭或返回格式不对：没有选项', () {
    expect(parseSignupSourceOptions({'enabled': false, 'options': []}), isEmpty);
    expect(parseSignupSourceOptions(null), isEmpty);
    expect(parseSignupSourceOptions({'enabled': true, 'options': 'x'}), isEmpty);
    expect(parseSignupSourceOptions({'data': _enabled()}).length, 9);
  });

  test('只提交在选项里的代码，没选即跳过', () {
    final options = parseSignupSourceOptions(_enabled());
    expect(selectedSignupSource(options, 'douyin'), 'douyin');
    expect(selectedSignupSource(options, ''), isNull);
    expect(selectedSignupSource(options, 'tiktok'), isNull);
    expect(selectedSignupSource(const [], 'douyin'), isNull);
  });

  testWidgets('开关关闭：手机号登录页不出现这道题', (tester) async {
    await _pump(tester, () async => {'enabled': false, 'options': []});
    expect(find.byKey(const Key('signup-source')), findsNothing);
    expect(find.textContaining('从哪知道我们'), findsNothing);
  });

  testWidgets('接口失败：不出题，不报错', (tester) async {
    await _pump(tester, () async => throw Exception('offline'));
    expect(find.byKey(const Key('signup-source')), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('开关打开：九个选项、可选可取消、没有输入框', (tester) async {
    await _pump(tester, () async => _enabled());
    expect(find.textContaining('从哪知道我们（选填，可跳过）'), findsOneWidget);
    for (final label in _labels) {
      expect(find.text(label), findsOneWidget);
    }
    expect(find.descendant(of: find.byKey(const Key('signup-source')), matching: find.byType(TextField)), findsNothing);
    final chip = find.byKey(const Key('signup-source-zhihu'));
    await tester.ensureVisible(chip);
    await tester.tap(chip);
    await tester.pumpAndSettle();
    expect(tester.widget<ChoiceChip>(chip).selected, isTrue);
    await tester.tap(chip);
    await tester.pumpAndSettle();
    expect(tester.widget<ChoiceChip>(chip).selected, isFalse);
  });
}
