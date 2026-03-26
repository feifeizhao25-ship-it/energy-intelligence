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

void main() => runApp(const EnergyIntelligenceApp());

class EnergyIntelligenceApp extends StatelessWidget {
  const EnergyIntelligenceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Energy Intelligence',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.buildTheme(),
      locale: const Locale('en', 'US'),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en', 'US'),
        Locale('ar', 'AE'),
        Locale('es', 'ES'),
        Locale('fr', 'FR'),
        Locale('de', 'DE'),
      ],
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
        '/ai': (context) => const AiAssistantScreen(),
        '/projects': (context) => const ProjectsScreen(),
        '/project-detail': (context) => const ProjectDetailScreen(),
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
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    DashboardScreen(),
    ProjectsScreen(),
    ResourceScreen(),
    FinanceScreen(),
    AiAssistantScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          boxShadow: [BoxShadow(color: Color(0x1A000000), blurRadius: 12, offset: Offset(0, -2))],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _NavItem(icon: Icons.grid_view_rounded, label: 'Dashboard', index: 0, current: _currentIndex, onTap: (i) => setState(() => _currentIndex = i)),
                _NavItem(icon: Icons.folder_outlined, label: 'Projects', index: 1, current: _currentIndex, onTap: (i) => setState(() => _currentIndex = i)),
                _NavItem(icon: Icons.wb_sunny_outlined, label: 'Resources', index: 2, current: _currentIndex, onTap: (i) => setState(() => _currentIndex = i)),
                _NavItem(icon: Icons.calculate_outlined, label: 'Finance', index: 3, current: _currentIndex, onTap: (i) => setState(() => _currentIndex = i)),
                _NavItem(icon: Icons.auto_awesome_outlined, label: 'AI', index: 4, current: _currentIndex, onTap: (i) => setState(() => _currentIndex = i)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final int index;
  final int current;
  final ValueChanged<int> onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.index,
    required this.current,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isActive = index == current;
    return GestureDetector(
      onTap: () => onTap(index),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 60,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 22, color: isActive ? AppTheme.primary : const Color(0xFF94A3B8)),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                color: isActive ? AppTheme.primary : const Color(0xFF94A3B8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
