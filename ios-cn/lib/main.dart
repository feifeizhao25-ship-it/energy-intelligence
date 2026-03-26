import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'services/api_service.dart';
import 'theme/app_theme.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/dashboard/dashboard_screen.dart';
import 'screens/resource/resource_screen.dart';
import 'screens/resource/solar_resource_screen.dart';
import 'screens/resource/wind_resource_screen.dart';
import 'screens/finance/finance_screen.dart';
import 'screens/finance/solar_finance_screen.dart';
import 'screens/operations/operations_screen.dart';
import 'screens/operations/health_screen.dart';
import 'screens/ai_assistant/ai_assistant_screen.dart';
import 'screens/projects/projects_screen.dart';
import 'screens/projects/project_detail_screen.dart';
import 'screens/research/research_screen.dart';
import 'screens/settings/settings_screen.dart';

void main() async {
  await ApiService.init(region: 'CN');
  runApp(const NewEnergyApp());
}

class NewEnergyApp extends StatelessWidget {
  const NewEnergyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '新能源智库',
      theme: AppTheme.buildTheme(),
      locale: const Locale('zh', 'CN'),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('zh', 'CN'),
        Locale('en', 'US'),
      ],
      debugShowCheckedModeBanner: false,
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/main': (context) => const MainNavigation(),
        '/dashboard': (context) => const DashboardScreen(),
        '/resource': (context) => const ResourceScreen(),
        '/resource/solar': (context) => const SolarResourceScreen(),
        '/resource/wind': (context) => const WindResourceScreen(),
        '/finance': (context) => const FinanceScreen(),
        '/finance/solar': (context) => const SolarFinanceScreen(),
        '/operations': (context) => const OperationsScreen(),
        '/operations/health': (context) => const HealthScreen(),
        '/ai-assistant': (context) => const AiAssistantScreen(),
        '/projects': (context) => const ProjectsScreen(),
        '/research': (context) => const ResearchScreen(),
        '/settings': (context) => const SettingsScreen(),
      },
    );
  }
}

class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _selectedIndex = 0;

  final List<Widget> _screens = const [
    DashboardScreen(),
    ProjectsScreen(),
    ResourceScreen(),
    FinanceScreen(),
    AiAssistantScreen(),
  ];

  final List<_NavItem> _navItems = const [
    _NavItem(icon: Icons.dashboard_outlined, activeIcon: Icons.dashboard, label: '首页'),
    _NavItem(icon: Icons.folder_outlined, activeIcon: Icons.folder, label: '项目'),
    _NavItem(icon: Icons.map_outlined, activeIcon: Icons.map, label: '资源'),
    _NavItem(icon: Icons.calculate_outlined, activeIcon: Icons.calculate, label: '计算'),
    _NavItem(icon: Icons.smart_toy_outlined, activeIcon: Icons.smart_toy, label: 'AI助手'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _selectedIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 16, offset: const Offset(0, -4)),
          ],
        ),
        child: SafeArea(
          child: SizedBox(
            height: 60,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(_navItems.length, (i) {
                final item = _navItems[i];
                final selected = i == _selectedIndex;
                return Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _selectedIndex = i),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          selected ? item.activeIcon : item.icon,
                          size: 22,
                          color: selected ? const Color(0xFF1D4ED8) : const Color(0xFF94A3B8),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          item.label,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                            color: selected ? const Color(0xFF1D4ED8) : const Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _NavItem({required this.icon, required this.activeIcon, required this.label});
}
