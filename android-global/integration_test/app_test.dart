import 'package:integration_test/integration_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app_android_global/services/api_service.dart';
      final proj = await ApiService.createProject(
        name: 'Germu Solar Plant $timestamp',
        technology: 'solar',
        latitude: 36.42,
        longitude: 94.91,
        capacityMw: 100,
        description: 'Flutter integration test',
      );
      expect(proj['name'], contains('Germu Solar Plant'));