import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global_ios/screens/dashboard/personal_home_binding.dart';

/// Every in-app link the backend can put on a card (runtime/backend/app/services/personal_workbench.py).
const backendHrefs = [
  '/dashboard', '/projects', '/projects/new', '/projects/timeline', '/resource', '/calculator', '/calculator/storage',
  '/reports', '/maintenance', '/assistant', '/papers', '/policy', '/onboarding',
];

void main() {
  test('every link the server can send maps to a screen this app registers', () {
    final main = File('lib/main.dart').readAsStringSync();
    for (final href in backendHrefs) {
      final route = PersonalHomeBinding.routeFor(href);
      expect(route, isNotNull, reason: href);
      expect(main.contains("'$route':"), isTrue, reason: '$href -> $route is not a route in main.dart');
    }
  });

  test('unknown or missing links do nothing instead of crashing', () {
    expect(PersonalHomeBinding.routeFor(null), isNull);
    expect(PersonalHomeBinding.routeFor('/nope'), isNull);
  });
}
