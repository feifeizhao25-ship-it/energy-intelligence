import 'package:flutter/material.dart';

/// Keeps the app to a readable column on wide windows (tablet / desktop / 1440 px browser) instead of stretching every
/// screen edge to edge (retest N06). Phones are untouched. The sides use the page colour with a hairline edge.
class ResponsiveFrame extends StatelessWidget {
  const ResponsiveFrame({super.key, required this.child, this.maxWidth = 960});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    if (mq.size.width <= maxWidth) return child;
    final theme = Theme.of(context);
    return ColoredBox(
      color: theme.scaffoldBackgroundColor,
      child: Center(
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border.symmetric(vertical: BorderSide(color: theme.dividerColor.withValues(alpha: 0.6))),
          ),
          child: SizedBox(
            width: maxWidth,
            child: MediaQuery(
              data: mq.copyWith(size: Size(maxWidth, mq.size.height)),
              child: ClipRect(child: child),
            ),
          ),
        ),
      ),
    );
  }
}
