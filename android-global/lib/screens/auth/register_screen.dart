import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  int _step = 0;
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _companyCtrl = TextEditingController();
  String _role = 'Developer';
  bool _gdprAccepted = false;
  bool _loading = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _companyCtrl.dispose();
    super.dispose();
  }

  Future<void> _register() async {
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
            height: 140,
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
                    const Text('Join Energy Intelligence', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                    const Text('Create your account', style: TextStyle(color: Colors.white70, fontSize: 14)),
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
                  Text('Step ${_step + 1} of 2', style: const TextStyle(fontSize: 14, color: Color(0xFF64748B))),
                  const SizedBox(height: 16),
                  if (_step == 0)
                    Column(
                      children: [
                        TextField(
                          controller: _nameCtrl,
                          decoration: const InputDecoration(labelText: 'Full Name', hintText: 'John Doe', prefixIcon: Icon(Icons.person_outline)),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _emailCtrl,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(labelText: 'Email', hintText: 'you@company.com', prefixIcon: Icon(Icons.email_outlined)),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _passCtrl,
                          obscureText: true,
                          decoration: const InputDecoration(labelText: 'Password', hintText: '••••••••', prefixIcon: Icon(Icons.lock_outline)),
                        ),
                        const SizedBox(height: 32),
                        ElevatedButton(
                          onPressed: () => setState(() => _step = 1),
                          child: const Text('Continue'),
                        ),
                      ],
                    )
                  else
                    Column(
                      children: [
                        TextField(
                          controller: _companyCtrl,
                          decoration: const InputDecoration(labelText: 'Company', hintText: 'Your Company Inc.', prefixIcon: Icon(Icons.business_outlined)),
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          value: _role,
                          decoration: const InputDecoration(labelText: 'Role', prefixIcon: Icon(Icons.work_outline)),
                          items: ['Developer', 'O&M Engineer', 'Investor', 'Researcher'].map((role) => DropdownMenuItem(value: role, child: Text(role))).toList(),
                          onChanged: (val) => setState(() => _role = val ?? 'Developer'),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Checkbox(
                              value: _gdprAccepted,
                              onChanged: (val) => setState(() => _gdprAccepted = val ?? false),
                            ),
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: const Text('I agree to the Terms of Service and Privacy Policy (GDPR compliant)', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 32),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => setState(() => _step = 0),
                                child: const Text('Back'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton(
                                onPressed: _gdprAccepted && !_loading ? _register : null,
                                child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Sign Up'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  const SizedBox(height: 16),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Text('Already have an account? ', style: TextStyle(color: Color(0xFF64748B), fontSize: 14)),
                    GestureDetector(
                      onTap: () => Navigator.pushNamed(context, '/login'),
                      child: const Text('Sign in', style: TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600, fontSize: 14)),
                    ),
                  ]),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
