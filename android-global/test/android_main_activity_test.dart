// Regression: the launcher activity declared in AndroidManifest (".MainActivity") resolves against the Gradle
// `namespace`. If MainActivity.kt sits in a different package the installed app dies at launch with
// ClassNotFoundException (found on a real Android emulator, 2026-11-05).
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('MainActivity.kt package matches the Gradle namespace (manifest .MainActivity resolves)', () {
    final gradle = File('android/app/build.gradle.kts').readAsStringSync();
    final ns = RegExp(r'namespace\s*=\s*"([^"]+)"').firstMatch(gradle)!.group(1)!;
    final manifest = File('android/app/src/main/AndroidManifest.xml').readAsStringSync();
    expect(manifest.contains('android:name=".MainActivity"'), isTrue);
    final path = 'android/app/src/main/kotlin/${ns.replaceAll('.', '/')}/MainActivity.kt';
    final f = File(path);
    expect(f.existsSync(), isTrue, reason: 'expected $path for namespace $ns');
    expect(f.readAsStringSync().contains('package $ns'), isTrue);
  });
}
