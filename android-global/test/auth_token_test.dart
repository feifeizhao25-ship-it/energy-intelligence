import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global/services/api_service.dart';

void main() {
  group('ApiService.accessTokenFrom', () {
    test('reads the token from the {code, message, data} wrapper', () {
      final token = ApiService.accessTokenFrom({
        'code': 0,
        'message': 'ok',
        'data': {'access_token': 'abc.def.ghi', 'refresh_token': 'r'},
      });
      expect(token, 'abc.def.ghi');
    });

    test('still accepts the legacy top-level access_token', () {
      expect(ApiService.accessTokenFrom({'access_token': 'legacy'}), 'legacy');
    });

    test('throws a readable English error instead of a cast error', () {
      expect(
        () => ApiService.accessTokenFrom({'code': 0, 'data': {}}),
        throwsA(isA<ApiException>().having(
            (e) => e.message, 'message', contains('Sign-in failed'))),
      );
    });
  });
}
