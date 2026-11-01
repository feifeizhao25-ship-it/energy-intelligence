import 'package:flutter/material.dart';

/// Reading / chat / form / settings screens are held to a 720 dp column (UI_WIDE_SCREEN_AND_GESTURES §2) inside the
/// 960 dp app frame. Card grids and data panels (dashboard, projects, resources) keep the full frame width.
class ReadingColumn extends StatelessWidget {
  const ReadingColumn({super.key, required this.child, this.maxWidth = 720});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      if (c.maxWidth <= maxWidth) return child;
      return Align(
        alignment: Alignment.topCenter,
        child: SizedBox(
          width: maxWidth,
          height: c.hasBoundedHeight ? c.maxHeight : null,
          child: child,
        ),
      );
    });
  }
}
