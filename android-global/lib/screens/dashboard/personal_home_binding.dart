import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/personal_home_section.dart';
import '../../widgets/personal_home_strings_en.dart';

/// Connects the personalised-home block to this app's API client and routes.
class PersonalHomeBinding {
  const PersonalHomeBinding._();

  /// This edition's text; the shared widget carries no language of its own.
  static const PersonalHomeStrings strings = kPersonalHomeStringsEn;

  static PersonalHomeApi api() => const PersonalHomeApi(load: ApiService.getWorkbench, setEnabled: ApiService.setWorkbenchEnabled);

  /// The server links cards to product areas; map them to the screens this app actually has.
  static const Map<String, String> _routes = {
    '/dashboard': '/dashboard',
    '/projects': '/projects',
    '/projects/new': '/projects',
    '/projects/timeline': '/projects',
    '/resource': '/resource',
    '/calculator': '/finance',
    '/calculator/storage': '/finance',
    '/reports': '/projects',
    '/maintenance': '/operations',
    '/assistant': '/ai',
    '/papers': '/research',
    '/policy': '/research',
    '/library': '/library',
    '/onboarding': '/settings',
  };

  static String? routeFor(String? href) => href == null ? null : _routes[href];

  static void open(BuildContext context, PersonalHomeCard card) {
    final route = routeFor(card.href);
    if (route != null) Navigator.of(context).pushNamed(route);
  }
}
