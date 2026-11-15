import 'package:flutter/material.dart';

/// Replacement for the red error screen. The shell stays usable; the failed
/// subtree shows a short card that says what happened and what to do next.
class CalmErrorCard extends StatelessWidget {
  /// 国内版只显示中文。保留 [english] 参数，只为与国际版的调用方式一致。
  const CalmErrorCard({super.key, this.english = false});

  final bool english;

  @override
  Widget build(BuildContext context) {
    const title = '这一处暂时显示不了';
    const body = '页面有一块没有绘制出来。请返回后重新打开。这里不会再铺满红色错误屏。';
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
///
/// The previous [FlutterError.onError] is kept. Widget tests record the build
/// exception there; replacing that handler leaves the failure uncaught and the
/// test hangs until it times out.
void installCalmErrorWidget({bool english = false}) {
  final previous = FlutterError.onError;
  FlutterError.onError = (FlutterErrorDetails details) {
    if (previous != null) {
      previous(details);
    } else {
      FlutterError.dumpErrorToConsole(details);
    }
  };
  ErrorWidget.builder = (FlutterErrorDetails details) => CalmErrorCard(english: english);
}
