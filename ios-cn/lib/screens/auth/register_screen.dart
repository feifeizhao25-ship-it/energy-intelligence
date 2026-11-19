import 'dart:async';

import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../widgets/reading_column.dart';
import '../../widgets/signup_source_picker.dart';

/// 发送短信验证码。默认调用 [ApiService.sendSms]（POST /api/v1/auth/sms/send）。
typedef SendSignupCodeFn = Future<void> Function({required String phone, required bool consent});

/// 校验验证码并登录；手机号第一次验证时服务端会创建账号。
/// 默认调用 [ApiService.loginWithSms]（POST /api/v1/auth/sms/login）。
typedef VerifySignupCodeFn = Future<String> Function({
  required String phone,
  required String code,
  required bool consent,
  String? signupSource,
});

/// 国内版注册：和网页版「手机号登录 / 注册」走同一套真实接口。
/// 只有服务端返回登录凭证后才进入工作台；接口失败就显示原因，不会假装已经注册。
/// 测试通过 [sendCode] / [verify] 注入替身，不发真实短信。
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, this.sendCode, this.verify, this.signupSourceLoader});

  final SendSignupCodeFn? sendCode;
  final VerifySignupCodeFn? verify;

  /// 取注册来源题选项；默认在配了服务器地址时请求 /api/v1/auth/signup-source（与登录页相同）。测试可注入。
  final Future<Object?> Function()? signupSourceLoader;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  bool _consent = false;
  bool _sending = false;
  bool _submitting = false;
  int _countdownSeconds = 0;
  Timer? _countdown;
  String? _notice;
  String? _error;
  // 注册来源题：开关由服务端决定，关闭或请求失败时没有选项、整块不显示；不选就是跳过。
  List<SignupSourceOption> _sourceOptions = const [];
  String _signupSource = '';

  @override
  void initState() {
    super.initState();
    _loadSignupSourceOptions();
  }

  Future<void> _loadSignupSourceOptions() async {
    final loader = widget.signupSourceLoader ?? (ApiService.hasBaseUrl ? ApiService.getSignupSourceOptions : null);
    if (loader == null) return;
    try {
      final options = parseSignupSourceOptions(await loader());
      if (mounted) setState(() => _sourceOptions = options);
    } catch (_) {
      // 拿不到选项就不出题，不影响注册
    }
  }

  @override
  void dispose() {
    _countdown?.cancel();
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  /// 11 位大陆手机号；允许用户带 +86 或空格。不合法时返回 null。
  String? _normalizedPhone() {
    var digits = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 13 && digits.startsWith('86')) digits = digits.substring(2);
    if (digits.length != 11 || !digits.startsWith('1')) return null;
    return digits;
  }

  bool _checkConsentAndPhone() {
    if (!_consent) {
      setState(() {
        _error = '请先勾选同意协议并接收验证码';
        _notice = null;
      });
      return false;
    }
    if (_normalizedPhone() == null) {
      setState(() {
        _error = '请输入有效的手机号';
        _notice = null;
      });
      return false;
    }
    return true;
  }

  Future<void> _sendCode() async {
    if (_sending || _countdownSeconds > 0 || !_checkConsentAndPhone()) return;
    setState(() {
      _sending = true;
      _error = null;
      _notice = null;
    });
    try {
      await (widget.sendCode ?? ApiService.sendSms)(phone: _normalizedPhone()!, consent: true);
      if (!mounted) return;
      setState(() {
        _notice = '验证码已发送，请注意查收短信';
        _countdownSeconds = 60;
      });
      _countdown?.cancel();
      _countdown = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted || _countdownSeconds <= 1) {
          timer.cancel();
          if (mounted) setState(() => _countdownSeconds = 0);
          return;
        }
        setState(() => _countdownSeconds--);
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '验证码发送失败：$e');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _submit() async {
    if (_submitting || !_checkConsentAndPhone()) return;
    final code = _codeController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() {
        _error = '请输入 6 位数字验证码';
        _notice = null;
      });
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await (widget.verify ?? ApiService.loginWithSms)(
        phone: _normalizedPhone()!,
        code: code,
        consent: true,
        signupSource: selectedSignupSource(_sourceOptions, _signupSource),
      );
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/dashboard', (route) => false);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '注册没有完成：$e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('手机号注册'), elevation: 0),
      body: ReadingColumn(child: SingleChildScrollView(
        padding: EdgeInsets.symmetric(
          horizontal: MediaQuery.sizeOf(context).width >= 700 ? 48 : 20,
          vertical: 20,
        ),
        child: Center(
          child: ConstrainedBox(
            // iPad / 宽屏：注册表单收成一列居中，不随屏幕拉宽。
            constraints: const BoxConstraints(maxWidth: 480),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  key: const Key('registerPhone'),
                  controller: _phoneController,
                  decoration: const InputDecoration(
                    labelText: '手机号',
                    prefixText: '+86 ',
                    prefixIcon: Icon(Icons.phone_outlined),
                  ),
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        key: const Key('registerCode'),
                        controller: _codeController,
                        decoration: const InputDecoration(labelText: '验证码'),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton(
                      key: const Key('registerSendCode'),
                      onPressed: _sending || _countdownSeconds > 0 ? null : _sendCode,
                      child: Text(_countdownSeconds > 0 ? '$_countdownSeconds 秒后重发' : '获取验证码'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      key: const Key('registerConsent'),
                      value: _consent,
                      onChanged: (value) => setState(() => _consent = value ?? false),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text('我已阅读并同意《用户协议》和《隐私政策》，并同意接收验证码', style: theme.textTheme.bodySmall),
                      ),
                    ),
                  ],
                ),
                SignupSourcePicker(
                  options: _sourceOptions,
                  value: _signupSource,
                  onChanged: (code) => setState(() => _signupSource = code),
                ),
                const SizedBox(height: 8),
                Text(
                  '验证通过后，第一次使用的手机号会创建账号，已注册的手机号直接登录。',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
                if (_notice != null) ...[
                  const SizedBox(height: 12),
                  Text(_notice!, key: const Key('registerNotice'), style: theme.textTheme.bodyMedium),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, key: const Key('registerError'), style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.error)),
                ],
                const SizedBox(height: 24),
                ElevatedButton(
                  key: const Key('registerSubmit'),
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('验证并注册'),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('返回登录'),
                ),
              ],
            ),
          ),
        ),
      )),
    );
  }
}
