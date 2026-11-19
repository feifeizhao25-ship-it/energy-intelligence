import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../widgets/reading_column.dart';
import '../../widgets/signup_source_picker.dart';

class ConfigErrorScreen extends StatelessWidget {
  const ConfigErrorScreen({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: ReadingColumn(child: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.settings_ethernet, size: 48, color: theme.colorScheme.primary),
                  const SizedBox(height: 16),
                  Text('还不能连接服务器', style: theme.textTheme.headlineSmall),
                  const SizedBox(height: 12),
                  Text(message, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
                ],
              ),
            ),
          ),
        ),
      )),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.signupSourceLoader});

  /// 取注册来源题选项的函数；默认在配了服务器地址时请求 /api/v1/auth/signup-source。测试可注入。
  final Future<Object?> Function()? signupSourceLoader;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  bool _showPassword = false;
  bool _isLoading = false;
  bool _consent = false;
  int _countdownSeconds = 0;
  // 注册来源题：开关由服务端决定，关闭或请求失败时没有选项、整块不显示；不选就是跳过。
  List<SignupSourceOption> _sourceOptions = const [];
  String _signupSource = '';

  @override
  void initState() {
    super.initState();
    _loadSignupSourceOptions();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _loadSignupSourceOptions() async {
    final loader = widget.signupSourceLoader ?? (ApiService.hasBaseUrl ? ApiService.getSignupSourceOptions : null);
    if (loader == null) return;
    try {
      final options = parseSignupSourceOptions(await loader());
      if (mounted) setState(() => _sourceOptions = options);
    } catch (_) {
      // 拿不到选项就不出题，不影响登录
    }
  }

  void _handleLogin() async {
    setState(() => _isLoading = true);
    try {
      await ApiService.login(email: _emailController.text, password: _passwordController.text);
      if (mounted) Navigator.of(context).pushReplacementNamed('/dashboard');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('登录失败：${e.toString()}')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _sendSms() async {
    if (!_consent) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请先同意接收验证码')));
      return;
    }
    try {
      await ApiService.sendSms(phone: _phoneController.text, consent: true);
      setState(() => _countdownSeconds = 60);
      Future.doWhile(() async {
        await Future.delayed(const Duration(seconds: 1));
        if (!mounted || _countdownSeconds <= 0) return false;
        setState(() => _countdownSeconds--);
        return _countdownSeconds > 0;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('验证码发送失败：${e.toString()}')));
    }
  }

  Future<void> _handlePhoneLogin() async {
    if (!_consent) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请先同意接收验证码')));
      return;
    }
    setState(() => _isLoading = true);
    try {
      await ApiService.loginWithSms(
        phone: _phoneController.text,
        code: _codeController.text,
        consent: true,
        signupSource: selectedSignupSource(_sourceOptions, _signupSource),
      );
      if (mounted) Navigator.of(context).pushReplacementNamed('/dashboard');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('登录失败：${e.toString()}')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final width = MediaQuery.sizeOf(context).width;
    final wide = width >= 700;
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: ReadingColumn(child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: dark ? AppTheme.nightGradient() : AppTheme.darkGradient(),
          image: const DecorationImage(image: AssetImage('assets/images/en_login_bg.webp'), fit: BoxFit.cover, opacity: 0.5),
        ),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                key: const Key('login-scroll'),
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: EdgeInsets.fromLTRB(wide ? 48 : 20, 12, wide ? 48 : 20, 24 + keyboard),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight - 36 - keyboard),
                  child: Center(
                    child: ConstrainedBox(
                      // iPad / 宽屏：登录卡片收成一列居中，不随屏幕拉宽。
                      constraints: const BoxConstraints(maxWidth: 480),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Center(
                            child: Container(
                              key: const Key('login-logo'),
                              width: wide ? 96 : 72,
                              height: wide ? 96 : 72,
                              decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                              child: Icon(Icons.wb_sunny, size: wide ? 52 : 40, color: AppTheme.primaryColor),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '新能源智库',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: wide ? 36 : 28, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          const SizedBox(height: 8),
                          const Text('智慧新能源运营平台', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: Color(0xFFCBD5E1))),
                          SizedBox(height: wide ? 36 : 20),
                          Card(
                            key: const Key('login-card'),
                            color: dark ? const Color(0xFF1E293B) : Colors.white,
                            child: Padding(
                              padding: EdgeInsets.fromLTRB(20, 12, 20, 16),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TabBar(
                                    controller: _tabController,
                                    tabs: const [Tab(text: '邮箱密码'), Tab(text: '手机验证码')],
                                  ),
                                  const SizedBox(height: 16),
                                  _tabController.index == 0 ? _buildEmailTab() : _buildPhoneTab(),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: () => Navigator.of(context).pushNamed('/register'),
                            child: const Text.rich(
                              TextSpan(
                                text: '没有账号？',
                                style: TextStyle(color: Colors.white70, fontSize: 14),
                                children: [
                                  TextSpan(
                                    text: '立即注册',
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      )),
    );
  }

  Widget _buildEmailTab() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _emailController,
          decoration: InputDecoration(
            hintText: '输入邮箱地址',
            prefixIcon: const Icon(Icons.email_outlined),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          ),
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _passwordController,
          decoration: InputDecoration(
            hintText: '输入密码',
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(_showPassword ? Icons.visibility : Icons.visibility_off),
              onPressed: () => setState(() => _showPassword = !_showPassword),
            ),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          ),
          obscureText: !_showPassword,
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleLogin,
            child: _isLoading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('登录'),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneTab() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _phoneController,
          decoration: InputDecoration(
            hintText: '手机号',
            prefixText: '+86 ',
            prefixIcon: const Icon(Icons.phone_outlined),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          ),
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _codeController,
                decoration: InputDecoration(
                  hintText: '验证码',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: 12),
            OutlinedButton(
              onPressed: _countdownSeconds == 0 ? _sendSms : null,
              child: Text(_countdownSeconds > 0 ? '${_countdownSeconds}s' : '获取验证码', style: const TextStyle(fontSize: 12)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SignupSourcePicker(
          options: _sourceOptions,
          value: _signupSource,
          onChanged: (code) => setState(() => _signupSource = code),
        ),
        Row(
          children: [
            Checkbox(value: _consent, onChanged: (value) => setState(() => _consent = value ?? false)),
            const Expanded(child: Text('同意接收验证码并用于登录', style: TextStyle(fontSize: 12))),
          ],
        ),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(onPressed: _isLoading ? null : _handlePhoneLogin, child: const Text('登录')),
        ),
      ],
    );
  }

}
