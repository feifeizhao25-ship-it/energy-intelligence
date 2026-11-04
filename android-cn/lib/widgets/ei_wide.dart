import 'package:flutter/material.dart';

/// Wide-screen helpers (UI test 2026-11-04: at 1440px the content column was simply stretched, with no side-by-side layout).
///
/// [EiContentFrame] centres a page and caps it at [maxWidth], so cards and text never run edge to edge.
/// [EiTwoColumn] puts two blocks side by side from [breakpoint] up and stacks them on phones, so tables and
/// summaries get the width instead of leaving it empty.
class EiContentFrame extends StatelessWidget {
  const EiContentFrame({super.key, required this.child, this.maxWidth = 1200});
  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(constraints: BoxConstraints(maxWidth: maxWidth), child: child),
      );
}

class EiTwoColumn extends StatelessWidget {
  const EiTwoColumn({super.key, required this.left, required this.right, this.breakpoint = 840, this.gap = 20, this.leftFlex = 3, this.rightFlex = 2});
  final Widget left;
  final Widget right;
  final double breakpoint;
  final double gap;
  final int leftFlex;
  final int rightFlex;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, box) {
          if (box.maxWidth < breakpoint) {
            return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [left, SizedBox(height: gap), right]);
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [Expanded(flex: leftFlex, child: left), SizedBox(width: gap), Expanded(flex: rightFlex, child: right)],
          );
        },
      );
}
