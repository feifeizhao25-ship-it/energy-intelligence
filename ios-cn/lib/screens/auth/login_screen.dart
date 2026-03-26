import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../dashboard/dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

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
  int _countdownSeconds = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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

  void _handleLogin() async {
    setState(() => _isLoading = true);
    try {
      await ApiService.login(
        email: _emailController.text,
        password: _passwordController.text,
      );
      if (mounted) {
        Navigator.of(context).pushReplacementNamed('/dashboard');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('登录失败：${e.toString()}')),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _startCountdown() {
    setState(() => _countdownSeconds = 60);
    Future.doWhile(() async {
      await Future.delayed(Duration(seconds: 1));
      if (_countdownSeconds > 0) {
        setState(() => _countdownSeconds--);
        return true;
      }
      return false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0F172A), Color(0xFF1D4ED8)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.wb_sunny,
                      size: 48,
                      color: AppTheme.primaryColor,
                    ),
                  ),
                  SizedBox(height: 16),
                  Text(
                    '新能源智库',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    '智慧新能源运营平台',
                    style: TextStyle(
                      fontSize: 14,
                      color: Color(0xFFCBD5E1),
                    ),
                  ),
                  SizedBox(height: 48),
                  Card(
                    elevation: 8,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          TabBar(
                            controller: _tabController,
                            tabs: [
                              Tab(text: '邮箱密码'),
                              Tab(text: '手机验证码'),
                            ],
                          ),
                          SizedBox(height: 24),
                          SizedBox(
                            height: 280,
                            child: TabBarView(
                              controller: _tabController,
                              children: [
                                _buildEmailTab(),
                                _buildPhoneTab(),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Expanded(
                        child: _buildSocialButton(Icons.chat, Colors.white),
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: _buildSocialButton(Icons.business, Colors.white),
                      ),
                    ],
                  ),
                  SizedBox(height: 16),
                  Text.rich(
                    TextSpan(
                      text: '没有账号？',
                      style: TextStyle(color: Colors.white70, fontSize: 14),
                      children: [
                        TextSpan(
                          text: '立即注册',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmailTab() {
    return Column(
      children: [
        TextField(
          controller: _emailController,
          decoration: InputDecoration(
            hintText: '输入邮箱地址',
            prefixIcon: Icon(Icons.email_outlined),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          keyboardType: TextInputType.emailAddress,
        ),
        SizedBox(height: 12),
        TextField(
          controller: _passwordController,
          decoration: InputDecoration(
            hintText: '输入密码',
            prefixIcon: Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(_showPassword ? Icons.visibility : Icons.visibility_off),
              onPressed: () => setState(() => _showPassword = !_showPassword),
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          obscureText: !_showPassword,
        ),
        SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleLogin,
            child: _isLoading
                ? SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text('登录'),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneTab() {
    return Column(
      children: [
        TextField(
          controller: _phoneController,
          decoration: InputDecoration(
            hintText: '手机号',
            prefixText: '+86 ',
            prefixIcon: Icon(Icons.phone_outlined),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          keyboardType: TextInputType.phone,
        ),
        SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _codeController,
                decoration: InputDecoration(
                  hintText: '验证码',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                keyboardType: TextInputType.number,
              ),
            ),
            SizedBox(width: 12),
            OutlinedButton(
              onPressed: _countdownSeconds == 0 ? _startCountdown : null,
              child: Text(
                _countdownSeconds > 0 ? '${_countdownSeconds}s' : '获取验证码',
                style: TextStyle(fontSize: 12),
              ),
            ),
          ],
        ),
        SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _handleLogin,
            child: Text('登录'),
          ),
        ),
      ],
    );
  }

  Widget _buildSocialButton(IconData icon, Color color) {
    return OutlinedButton(
      onPressed: () {},
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: Colors.white30),
      ),
      child: Icon(icon, color: color, size: 20),
    );
  }
}
