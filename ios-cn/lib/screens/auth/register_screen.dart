import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  int _currentStep = 0;
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _companyController = TextEditingController();
  String _selectedRole = '';
  bool _agreedToTerms = false;

  final List<Map<String, dynamic>> roles = [
    {'title': '项目经理', 'emoji': '👔'},
    {'title': '技术总监', 'emoji': '🔧'},
    {'title': '财务分析', 'emoji': '💰'},
    {'title': '运维主管', 'emoji': '⚙️'},
    {'title': '其他', 'emoji': '📝'},
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _companyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('创建账号'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20),
        child: Column(
          children: [
            _buildStepIndicator(),
            SizedBox(height: 32),
            _currentStep == 0 ? _buildStep1() : _buildStep2(),
            SizedBox(height: 24),
            Row(
              children: [
                if (_currentStep > 0)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => setState(() => _currentStep = 0),
                      child: Text('上一步'),
                    ),
                  ),
                if (_currentStep > 0) SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _handleNextStep,
                    child: Text(_currentStep == 0 ? '下一步' : '注册'),
                  ),
                ),
              ],
            ),
            SizedBox(height: 16),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('返回登录'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepIndicator() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildStepCircle(0, '基本信息'),
        SizedBox(width: 24),
        Container(
          width: 40,
          height: 2,
          color: _currentStep > 0 ? AppTheme.primaryColor : Color(0xFFE2E8F0),
        ),
        SizedBox(width: 24),
        _buildStepCircle(1, '公司信息'),
      ],
    );
  }

  Widget _buildStepCircle(int step, String label) {
    bool isActive = _currentStep >= step;
    return Column(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: isActive ? AppTheme.primaryColor : Color(0xFFE2E8F0),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              '${step + 1}',
              style: TextStyle(
                color: isActive ? Colors.white : Color(0xFF94A3B8),
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
          ),
        ),
        SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: isActive ? AppTheme.primaryColor : Color(0xFF94A3B8),
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('基本信息', style: Theme.of(context).textTheme.headlineSmall),
        SizedBox(height: 16),
        TextField(
          controller: _nameController,
          decoration: InputDecoration(
            labelText: '姓名',
            prefixIcon: Icon(Icons.person_outline),
          ),
        ),
        SizedBox(height: 12),
        TextField(
          controller: _emailController,
          decoration: InputDecoration(
            labelText: '邮箱',
            prefixIcon: Icon(Icons.email_outlined),
          ),
          keyboardType: TextInputType.emailAddress,
        ),
        SizedBox(height: 12),
        TextField(
          controller: _phoneController,
          decoration: InputDecoration(
            labelText: '手机号',
            prefixText: '+86 ',
            prefixIcon: Icon(Icons.phone_outlined),
          ),
          keyboardType: TextInputType.phone,
        ),
        SizedBox(height: 12),
        TextField(
          controller: _passwordController,
          decoration: InputDecoration(
            labelText: '密码',
            prefixIcon: Icon(Icons.lock_outline),
          ),
          obscureText: true,
        ),
        SizedBox(height: 12),
        TextField(
          controller: _confirmPasswordController,
          decoration: InputDecoration(
            labelText: '确认密码',
            prefixIcon: Icon(Icons.lock_outline),
          ),
          obscureText: true,
        ),
      ],
    );
  }

  Widget _buildStep2() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('公司信息', style: Theme.of(context).textTheme.headlineSmall),
        SizedBox(height: 16),
        TextField(
          controller: _companyController,
          decoration: InputDecoration(
            labelText: '公司名称',
            prefixIcon: Icon(Icons.business_outlined),
          ),
        ),
        SizedBox(height: 20),
        Text('选择职位', style: Theme.of(context).textTheme.titleMedium),
        SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          children: roles.map((role) {
            bool isSelected = _selectedRole == role['title'];
            return GestureDetector(
              onTap: () => setState(() => _selectedRole = role['title']),
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(
                    color: isSelected ? AppTheme.primaryColor : Color(0xFFE2E8F0),
                    width: isSelected ? 2 : 1,
                  ),
                  borderRadius: BorderRadius.circular(12),
                  color: isSelected ? AppTheme.primaryColor.withOpacity(0.1) : Colors.white,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(role['emoji'], style: TextStyle(fontSize: 32)),
                    SizedBox(height: 8),
                    Text(
                      role['title'],
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isSelected ? AppTheme.primaryColor : Color(0xFF475569),
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
        SizedBox(height: 20),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: _agreedToTerms,
              onChanged: (value) => setState(() => _agreedToTerms = value ?? false),
            ),
            Expanded(
              child: Text.rich(
                TextSpan(
                  text: '我已阅读并同意',
                  style: TextStyle(fontSize: 12),
                  children: [
                    TextSpan(
                      text: '《用户协议》',
                      style: TextStyle(
                        color: AppTheme.primaryColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    TextSpan(text: '和'),
                    TextSpan(
                      text: '《隐私政策》',
                      style: TextStyle(
                        color: AppTheme.primaryColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  void _handleNextStep() {
    if (_currentStep == 0) {
      if (_nameController.text.isEmpty ||
          _emailController.text.isEmpty ||
          _phoneController.text.isEmpty ||
          _passwordController.text.isEmpty ||
          _confirmPasswordController.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('请填写所有字段')),
        );
        return;
      }
      if (_passwordController.text != _confirmPasswordController.text) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('两次输入的密码不一致')),
        );
        return;
      }
      setState(() => _currentStep = 1);
    } else {
      if (_companyController.text.isEmpty || _selectedRole.isEmpty || !_agreedToTerms) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('请填写所有信息并同意协议')),
        );
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('注册成功！')),
      );
      Navigator.of(context).pop();
    }
  }
}
