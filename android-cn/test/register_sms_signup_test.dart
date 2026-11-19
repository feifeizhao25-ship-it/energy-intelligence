import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/screens/auth/register_screen.dart';

/// 「立即注册」必须走真实的短信注册接口：这里用替身代替 ApiService，不发真实短信。
class _FakeSignupApi {
  final sent = <String>[];
  final verified = <String>[];
  final sources = <String?>[];
  Object? sendError;
  Object? verifyError;

  Future<void> sendCode({required String phone, required bool consent}) async {
    expect(consent, isTrue);
    if (sendError != null) throw sendError!;
    sent.add(phone);
  }

  Future<String> verify({required String phone, required String code, required bool consent, String? signupSource}) async {
    expect(consent, isTrue);
    if (verifyError != null) throw verifyError!;
    verified.add('$phone:$code');
    sources.add(signupSource);
    return 'token';
  }
}

Future<void> _pump(WidgetTester t, _FakeSignupApi api, {Future<Object?> Function()? sourceLoader}) async {
  t.view.physicalSize = const Size(402, 1200);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  await t.pumpWidget(MaterialApp(
    routes: {'/dashboard': (_) => const Scaffold(body: Text('工作台'))},
    home: RegisterScreen(sendCode: api.sendCode, verify: api.verify, signupSourceLoader: sourceLoader),
  ));
}

Future<void> _tap(WidgetTester t, String key) async {
  await t.tap(find.byKey(Key(key)));
  await t.pump();
}

void main() {
  testWidgets('没勾选同意时不发验证码、不注册', (t) async {
    final api = _FakeSignupApi();
    await _pump(t, api);
    await t.enterText(find.byKey(const Key('registerPhone')), '13800138000');
    await _tap(t, 'registerSendCode');
    await t.enterText(find.byKey(const Key('registerCode')), '123456');
    await _tap(t, 'registerSubmit');
    expect(api.sent, isEmpty);
    expect(api.verified, isEmpty);
    expect(find.text('请先勾选同意协议并接收验证码'), findsOneWidget);
    expect(find.text('工作台'), findsNothing);
  });

  testWidgets('手机号不合法时不调接口', (t) async {
    final api = _FakeSignupApi();
    await _pump(t, api);
    await _tap(t, 'registerConsent');
    await t.enterText(find.byKey(const Key('registerPhone')), '12345');
    await _tap(t, 'registerSendCode');
    expect(api.sent, isEmpty);
    expect(find.text('请输入有效的手机号'), findsOneWidget);
  });

  testWidgets('发验证码、校验通过后才进入工作台', (t) async {
    final api = _FakeSignupApi();
    await _pump(t, api);
    await _tap(t, 'registerConsent');
    await t.enterText(find.byKey(const Key('registerPhone')), '+86 138 0013 8000');
    await _tap(t, 'registerSendCode');
    expect(api.sent, ['13800138000']);
    expect(find.text('验证码已发送，请注意查收短信'), findsOneWidget);
    expect(find.text('60 秒后重发'), findsOneWidget);
    await t.enterText(find.byKey(const Key('registerCode')), '654321');
    await _tap(t, 'registerSubmit');
    await t.pumpAndSettle();
    expect(api.verified, ['13800138000:654321']);
    expect(api.sources, [null]); // 没有来源题时不提交来源
    expect(find.text('工作台'), findsOneWidget);
  });

  testWidgets('验证码校验失败时显示原因，留在注册页', (t) async {
    final api = _FakeSignupApi()..verifyError = Exception('验证码不正确或已过期');
    await _pump(t, api);
    await _tap(t, 'registerConsent');
    await t.enterText(find.byKey(const Key('registerPhone')), '13800138000');
    await t.enterText(find.byKey(const Key('registerCode')), '000000');
    await _tap(t, 'registerSubmit');
    await t.pump();
    expect(find.textContaining('注册没有完成'), findsOneWidget);
    expect(find.textContaining('验证码不正确或已过期'), findsOneWidget);
    expect(find.text('工作台'), findsNothing);
  });

  testWidgets('短信服务不可用时如实提示，不开始倒计时', (t) async {
    final api = _FakeSignupApi()..sendError = Exception('短信服务未配置');
    await _pump(t, api);
    await _tap(t, 'registerConsent');
    await t.enterText(find.byKey(const Key('registerPhone')), '13800138000');
    await _tap(t, 'registerSendCode');
    await t.pump();
    expect(find.textContaining('验证码发送失败'), findsOneWidget);
    expect(find.text('获取验证码'), findsOneWidget);
  });

  testWidgets('验证码不是 6 位数字时不调接口', (t) async {
    final api = _FakeSignupApi();
    await _pump(t, api);
    await _tap(t, 'registerConsent');
    await t.enterText(find.byKey(const Key('registerPhone')), '13800138000');
    await t.enterText(find.byKey(const Key('registerCode')), '12');
    await _tap(t, 'registerSubmit');
    expect(api.verified, isEmpty);
    expect(find.text('请输入 6 位数字验证码'), findsOneWidget);
  });

  testWidgets('来源题打开时可选填，选中的代码随注册一起提交', (t) async {
    final api = _FakeSignupApi();
    await _pump(t, api, sourceLoader: () async => {
          'data': {
            'enabled': true,
            'options': [
              {'code': 'search', 'label': '搜索引擎'},
              {'code': 'friend', 'label': '朋友推荐'},
            ],
          },
        });
    await t.pump();
    expect(find.byKey(const Key('signup-source')), findsOneWidget);
    await _tap(t, 'signup-source-friend');
    await _tap(t, 'registerConsent');
    await t.enterText(find.byKey(const Key('registerPhone')), '13800138000');
    await t.enterText(find.byKey(const Key('registerCode')), '123456');
    await _tap(t, 'registerSubmit');
    await t.pumpAndSettle();
    expect(api.sources, ['friend']);
    expect(find.text('工作台'), findsOneWidget);
  });

  testWidgets('来源题关闭时不显示，也不提交来源', (t) async {
    final api = _FakeSignupApi();
    await _pump(t, api, sourceLoader: () async => {'data': {'enabled': false, 'options': []}});
    await t.pump();
    expect(find.byKey(const Key('signup-source')), findsNothing);
  });
}
