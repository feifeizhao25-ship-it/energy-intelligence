import 'package:flutter/material.dart';

/// Replacement for the red error screen. The shell stays usable; the failed
/// subtree shows a short card that says what happened and what to do next.
class CalmErrorCard extends StatelessWidget {
  /// The international edition is English only. [english] is kept so main.dart and the
  /// shared test call the card the same way as the Chinese edition does.
  const CalmErrorCard({super.key, this.english = true});

  final bool english;

  @override
  Widget build(BuildContext context) {
    const title = 'This section could not be shown';
    const body = 'A part of the screen failed to draw. Go back and open it again. The red error screen is not used.';
    return Material(
      color: const Color(0xFFF5F7FA),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            key: const Key('calm-error-card'),
            elevation: 0,
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Text(body, style: const TextStyle(fontSize: 13, height: 1.45, color: Color(0xFF4C5A75))),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Log the failure and show [CalmErrorCard] instead of the red screen.
void installCalmErrorWidget({bool english = true}) {
  FlutterError.onError = (details) {
    FlutterError.dumpErrorToConsole(details);
  };
  ErrorWidget.builder = (FlutterErrorDetails details) => CalmErrorCard(english: english);
}
