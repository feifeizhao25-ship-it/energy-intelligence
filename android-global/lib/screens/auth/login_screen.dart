import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _showPass = false;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    setState(() => _loading = true);
    await Future.delayed(const Duration(seconds: 1));
    if (!mounted) return;
    setState(() => _loading = false);
    Navigator.pushReplacementNamed(context, '/main');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          Container(
            height: 220,
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient(),
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(28),
                bottomRight: Radius.circular(28),
              ),
            ),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Row(children: [
                      const Icon(Icons.bolt, color: Colors.white, size: 32),
                      const SizedBox(width: 8),
                      const Text('Energy Intelligence', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                    ]),
                    const SizedBox(height: 12),
                    const Text('Welcome back', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold)),
                    const Text('Sign in to your account', style: TextStyle(color: Colors.white70, fontSize: 14)),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  OutlinedButton.icon(
                    onPressed: _login,
                    icon: const Icon(Icons.login, size: 20),
                    label: const Text('Continue with Google'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF1E293B),
                      side: const BorderSide(color: Color(0xFFE2E8F0)),
                      minimumSize: const Size(double.infinity, 48),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Row(children: [
                    Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                    Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('or', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12))),
                    Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                  ]),
                  const SizedBox(height: 16),
                  Container(
                    decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10)),
                    child: TabBar(
                      controller: _tabController,
                      indicator: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 4)]),
                      indicatorSize: TabBarIndicatorSize.tab,
                      labelColor: const Color(0xFF1E293B),
                      unselectedLabelColor: const Color(0xFF64748B),
                      dividerColor: Colors.transparent,
                      tabs: const [Tab(text: 'Password'), Tab(text: 'Magic Link')],
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    height: 200,
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        Column(
                          children: [
                            TextField(
                              controller: _emailCtrl,
                              keyboardType: TextInputType.emailAddress,
                              decoration: const InputDecoration(labelText: 'Email', hintText: 'you@company.com', prefixIcon: Icon(Icons.email_outlined)),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _passCtrl,
                              obscureText: !_showPass,
                              decoration: InputDecoration(
                                labelText: 'Password',
                                hintText: '••••••••',
                                prefixIcon: const Icon(Icons.lock_outline),
                                suffixIcon: IconButton(icon: Icon(_showPass ? Icons.visibility_off : Icons.visibility), onPressed: () => setState(() => _showPass = !_showPass)),
                              ),
                            ),
                          ],
                        ),
                        Column(
                          children: [
                            TextField(
                              controller: _emailCtrl,
                              keyboardType: TextInputType.emailAddress,
                              decoration: const InputDecoration(labelText: 'Email', hintText: 'you@company.com', prefixIcon: Icon(Icons.email_outlined)),
                            ),
                            const SizedBox(height: 8),
                            const Text('We\'ll send a magic sign-in link to your email.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: _loading ? null : _login,
                    child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Sign In'),
                  ),
                  const SizedBox(height: 16),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Text("Don't have an account? ", style: TextStyle(color: Color(0xFF64748B), fontSize: 14)),
                    GestureDetector(
                      onTap: () => Navigator.pushNamed(context, '/register'),
                      child: const Text('Sign up free', style: TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600, fontSize: 14)),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  const Text('By signing in, you agree to our Terms and Privacy Policy (GDPR compliant).', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
