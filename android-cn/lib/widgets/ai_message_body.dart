import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_math_fork/flutter_math.dart';

/// Renders an assistant answer: LaTeX formulas as typeset math, [S1] markers as tappable source chips,
/// and a source list under the answer. A marker with no matching source is dropped rather than shown.
///
/// Source maps follow the backend evidence envelope: title, url, publisher, published_at,
/// retrieved_at, freshness_status, relevance_score.
class AiMessageBody extends StatelessWidget {
  const AiMessageBody({
    super.key,
    required this.text,
    this.sources = const [],
    this.color,
    this.fontSize = 13,
    this.showSourceList = true,
  });

  final String text;
  final List<Map<String, dynamic>> sources;
  final Color? color;
  final double fontSize;
  final bool showSourceList;

  static const bool _zh = true;

  static String _t(String zh, String en) => _zh ? zh : en;

  // $$..$$, \[..\], \(..\), and $..$ (inline dollars only when the content looks like TeX, so "$5 and $6" stays text)
  static final RegExp _math = RegExp(
    r'\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^\$\n]*?[\\^_{][^\$\n]*?)\$',
  );
  static final RegExp _cite = RegExp(r'\[S(\d+)\]');

  /// Splits [text] into plain text, math, and citation tokens (exposed for tests).
  static List<AiToken> tokenize(String text) {
    final out = <AiToken>[];
    void plain(String s) {
      var last = 0;
      for (final m in _cite.allMatches(s)) {
        if (m.start > last) out.add(AiToken.text(s.substring(last, m.start)));
        out.add(AiToken.cite(int.parse(m.group(1)!)));
        last = m.end;
      }
      if (last < s.length) out.add(AiToken.text(s.substring(last)));
    }

    var last = 0;
    for (final m in _math.allMatches(text)) {
      if (m.start > last) plain(text.substring(last, m.start));
      final display = m.group(1) != null || m.group(2) != null;
      final tex = (m.group(1) ?? m.group(2) ?? m.group(3) ?? m.group(4))!.trim();
      out.add(AiToken.math(tex, display));
      last = m.end;
    }
    if (last < text.length) plain(text.substring(last));
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final base = TextStyle(
      fontSize: fontSize,
      height: 1.5,
      color: color ?? Theme.of(context).colorScheme.onSurface,
    );
    final tokens = tokenize(text);
    final spans = <InlineSpan>[];
    final blocks = <Widget>[];
    final used = <int>{};

    void flush() {
      if (spans.isEmpty) return;
      blocks.add(Text.rich(TextSpan(style: base, children: List.of(spans))));
      spans.clear();
    }

    for (final t in tokens) {
      switch (t.kind) {
        case AiTokenKind.text:
          spans.add(TextSpan(text: t.value));
        case AiTokenKind.math:
          final math = Math.tex(
            t.value,
            mathStyle: t.display ? MathStyle.display : MathStyle.text,
            textStyle: base,
            onErrorFallback: (err) => Text(t.value, style: base.copyWith(fontFamily: 'monospace')),
          );
          if (t.display) {
            flush();
            blocks.add(Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: math),
            ));
          } else {
            spans.add(WidgetSpan(alignment: PlaceholderAlignment.middle, child: math));
          }
        case AiTokenKind.cite:
          final idx = t.number - 1;
          if (idx >= 0 && idx < sources.length) {
            used.add(idx);
            spans.add(WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: _SourceChip(
                label: 'S${t.number}',
                onTap: () => showSourceSheet(context, t.number, sources[idx]),
              ),
            ));
          }
      }
    }
    flush();

    if (showSourceList) {
      blocks.add(const SizedBox(height: 8));
      blocks.add(_sourceFooter(context, base));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: blocks);
  }

  Widget _sourceFooter(BuildContext context, TextStyle base) {
    final small = base.copyWith(fontSize: fontSize - 2, color: base.color?.withValues(alpha: 0.75));
    if (sources.isEmpty) {
      return Text(
        _t('本回答未检索到可引用的来源，请自行核对。', 'No source was found for this answer; please verify it yourself.'),
        key: const ValueKey('ai-no-sources'),
        style: small,
      );
    }
    return Column(
      key: const ValueKey('ai-source-list'),
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(_t('来源', 'Sources'), style: small.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        for (var i = 0; i < sources.length; i++)
          InkWell(
            key: ValueKey('ai-source-${i + 1}'),
            onTap: () => showSourceSheet(context, i + 1, sources[i]),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Text.rich(TextSpan(style: small, children: [
                TextSpan(text: '[S${i + 1}] ', style: small.copyWith(fontWeight: FontWeight.w600)),
                TextSpan(text: _line(sources[i])),
              ])),
            ),
          ),
      ],
    );
  }

  static String _line(Map<String, dynamic> s) {
    final parts = <String>[
      (s['title'] ?? '').toString(),
      (s['publisher'] ?? '').toString(),
      (s['published_at'] ?? '').toString(),
    ].where((e) => e.isNotEmpty && e != 'null').toList();
    return parts.join(' · ');
  }

  static Future<void> showSourceSheet(BuildContext context, int number, Map<String, dynamic> s) {
    String v(String k) {
      final x = s[k];
      return x == null || x.toString().isEmpty ? '—' : x.toString();
    }

    final url = s['url']?.toString() ?? '';
    final rel = s['relevance_score'];
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            key: const ValueKey('ai-source-sheet'),
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('[S$number] ${v('title')}', style: Theme.of(ctx).textTheme.titleMedium),
              const SizedBox(height: 12),
              _row(ctx, _t('发布机构', 'Publisher'), v('publisher')),
              _row(ctx, _t('发布日期', 'Published'), v('published_at')),
              _row(ctx, _t('核验日期', 'Retrieved'), v('retrieved_at')),
              _row(ctx, _t('时效状态', 'Freshness'), v('freshness_status')),
              if (rel is num) _row(ctx, _t('检索相关度', 'Relevance'), rel.toStringAsFixed(2)),
              if (url.isNotEmpty) ...[
                const SizedBox(height: 8),
                SelectableText(url, style: const TextStyle(decoration: TextDecoration.underline)),
                TextButton.icon(
                  icon: const Icon(Icons.copy, size: 16),
                  label: Text(_t('复制原文链接', 'Copy link')),
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: url));
                    if (ctx.mounted) Navigator.of(ctx).pop();
                  },
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static Widget _row(BuildContext ctx, String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 92, child: Text(k, style: Theme.of(ctx).textTheme.bodySmall)),
          Expanded(child: Text(v)),
        ]),
      );
}

enum AiTokenKind { text, math, cite }

class AiToken {
  const AiToken._(this.kind, this.value, this.display, this.number);
  factory AiToken.text(String v) => AiToken._(AiTokenKind.text, v, false, 0);
  factory AiToken.math(String v, bool display) => AiToken._(AiTokenKind.math, v, display, 0);
  factory AiToken.cite(int n) => AiToken._(AiTokenKind.cite, '[S$n]', false, n);
  final AiTokenKind kind;
  final String value;
  final bool display;
  final int number;
}

class _SourceChip extends StatelessWidget {
  const _SourceChip({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        key: ValueKey('ai-cite-$label'),
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 2),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
          decoration: BoxDecoration(
            color: scheme.primaryContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(label, style: TextStyle(fontSize: 11, color: scheme.onPrimaryContainer, fontWeight: FontWeight.w600)),
        ),
      ),
    );
  }
}
