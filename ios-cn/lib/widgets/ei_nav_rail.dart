import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class EiNavDest {
  const EiNavDest(this.icon, this.activeIcon, this.label);
  final IconData icon;
  final IconData activeIcon;
  final String label;
}

/// Side navigation used from 600 dp up instead of the bottom bar (UI_WIDE_SCREEN_AND_GESTURES §3).
class EiNavRail extends StatelessWidget {
  const EiNavRail({super.key, required this.dests, required this.index, required this.onSelect});

  final List<EiNavDest> dests;
  final int index;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final active = dark ? const Color(0xFF60A5FA) : const Color(0xFF1D4ED8);
    final idle = dark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    return Container(
      decoration: BoxDecoration(
        color: context.eiCard,
        border: Border(right: BorderSide(color: context.eiLine)),
      ),
      child: SafeArea(
        child: NavigationRail(
          backgroundColor: Colors.transparent,
          selectedIndex: index,
          onDestinationSelected: onSelect,
          labelType: NavigationRailLabelType.all,
          minWidth: 80,
          selectedIconTheme: IconThemeData(color: active),
          unselectedIconTheme: IconThemeData(color: idle),
          selectedLabelTextStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: active),
          unselectedLabelTextStyle: TextStyle(fontSize: 12, color: idle),
          indicatorColor: active.withValues(alpha: 0.14),
          destinations: [
            for (var i = 0; i < dests.length; i++)
              NavigationRailDestination(
                icon: Icon(dests[i].icon, key: Key('navRail$i')),
                selectedIcon: Icon(dests[i].activeIcon),
                label: Text(dests[i].label),
              ),
          ],
        ),
      ),
    );
  }
}
