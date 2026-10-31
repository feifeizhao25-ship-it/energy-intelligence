import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/personal_home_section.dart';

/// Connects the personalised-home block to this app's API client and routes.
class PersonalHomeBinding {
  const PersonalHomeBinding._();

  static PersonalHomeApi api() => const PersonalHomeApi(load: ApiService.getWorkbench, setEnabled: ApiService.setWorkbenchEnabled);

  /// The server links cards to product areas; map them to the screens this app actually has.
  static const Map<String, String> _routes = {
    '/dashboard': '/dashboard',
    '/projects': '/projects',
    '/projects/new': '/projects/new',
    '/projects/timeline': '/projects',
    '/resource': '/resource',
    '/calculator': '/finance',
    '/calculator/storage': '/finance',
    '/reports': '/projects',
    '/maintenance': '/operations',
    '/assistant': '/ai-assistant',
    '/papers': '/research',
    '/policy': '/research',
    '/onboarding': '/settings',
  };

  static String? routeFor(String? href) => href == null ? null : _routes[href];

  static void open(BuildContext context, PersonalHomeCard card) {
    final route = routeFor(card.href);
    if (route != null) Navigator.of(context).pushNamed(route);
  }
}
