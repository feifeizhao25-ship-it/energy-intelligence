package dev.flutter.plugins.integration_test;

import androidx.annotation.NonNull;
import io.flutter.embedding.engine.plugins.FlutterPlugin;

/**
 * Release-only stand-in. integration_test is a dev dependency, so its classes
 * are on the debug classpath only, but the shared plugin registrant still
 * constructs this type for every build. The real plugin is unchanged for debug
 * and profile. This class does nothing at runtime.
 */
public final class IntegrationTestPlugin implements FlutterPlugin {
    @Override
    public void onAttachedToEngine(@NonNull FlutterPluginBinding binding) {}

    @Override
    public void onDetachedFromEngine(@NonNull FlutterPluginBinding binding) {}
}
