import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../settings/plan_usage_screen.dart';

/// Asks the server (POST /api/v1/ai/chat-json) and shows the answer as cards: one-sentence conclusion, key figures,
/// the full text (collapsed), the sources the answer actually cited, risks and plain explanations of jargon.
/// Nothing is invented on the device: every card is built from the `structured` object the server returns.
typedef AiChatFn = Future<Map<String, dynamic>> Function(String message, String style);

/// Removes Markdown symbols the chat bubble cannot render (###, **, backticks) and turns "- " into bullets.
String cleanAnswerText(String raw) {
  final lines = raw.split('\n').map((line) {
    var l = line.replaceFirst(RegExp(r'^\s*#{1,6}\s*'), '');
    l = l.replaceAllMapped(RegExp(r'\*\*(.+?)\*\*'), (m) => m[1]!);
    l = l.replaceAll('`', '');
    l = l.replaceFirst(RegExp(r'^\s*[-*]\s+'), '• ');
    return l;
  });
  return lines.join('\n').replaceAll(RegExp(r'\n{3,}'), '\n\n').trim();
}

class _Msg {
  final String text;
  final bool isUser;
  final Map<String, dynamic>? structured;
  final String? error; // generic | quota | login
  final String? retryText;
  const _Msg({required this.text, required this.isUser, this.structured, this.error, this.retryText});
}

class AiAssistantScreen extends StatefulWidget {
  final AiChatFn? chat;
  const AiAssistantScreen({super.key, this.chat});

  @override
  State<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends State<AiAssistantScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  final List<_Msg> _messages = [];
  bool _busy = false;
  String _style = 'pro';

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send(String text) async {
    final q = text.trim();
    if (q.isEmpty || _busy) return;
    setState(() {
      _messages.add(_Msg(text: q, isUser: true));
      _busy = true;
      _controller.clear();
    });
    _toBottom();
    try {
      final result = await (widget.chat ?? ApiService.askAssistant)(q, _style);
      if (!mounted) return;
      final answer = '${result['message'] ?? ''}'.trim();
      if (answer.isEmpty) throw StateError('empty answer');
      final structured = result['structured'];
      setState(() {
        _messages.add(_Msg(text: answer, isUser: false, structured: structured is Map ? Map<String, dynamic>.from(structured) : null));
        _busy = false;
      });
    } catch (e) {
      if (!mounted) return;
      final status = e is ApiException ? e.statusCode : 0;
      setState(() {
        _messages.add(_Msg(
          text: status == 429 ? 'You have used today\'s AI questions. Try again tomorrow, or check your limits under Plan & usage.' : status == 401 ? 'Your session expired. Please sign in again.' : 'The network or service is unavailable. Your question is kept so you can retry.',
          isUser: false,
          error: status == 429 ? 'quota' : status == 401 ? 'login' : 'generic',
          retryText: q,
        ));
        _busy = false;
      });
    }
    _toBottom();
  }

  void _toBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI Assistant')),
      body: SafeArea(
        child: Column(children: [
          _styleBar(context),
          Expanded(
            child: _messages.isEmpty
                ? _empty(context)
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    itemCount: _messages.length + (_busy ? 1 : 0),
                    itemBuilder: (context, i) => i == _messages.length ? _thinking(context) : _bubble(context, _messages[i]),
                  ),
          ),
          _input(context),
        ]),
      ),
    );
  }

  Widget _styleBar(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(children: [
        Text('Answer style', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
        const SizedBox(width: 10),
        Expanded(
          child: Semantics(
            container: true,
            label: 'Answer style',
            child: SegmentedButton<String>(
              key: const Key('styleSwitch'),
              showSelectedIcon: false,
              style: const ButtonStyle(visualDensity: VisualDensity.compact),
              segments: const [
                ButtonSegment(value: 'plain', label: Text('Plain words')),
                ButtonSegment(value: 'pro', label: Text('Technical')),
              ],
              selected: {_style},
              onSelectionChanged: (s) => setState(() => _style = s.first),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _empty(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final prompts = const ['How much sun does a site get?', 'What does IRR mean for a solar project?', 'How does battery storage make money?'];
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(color: AppTheme.primaryColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
            child: Icon(Icons.auto_awesome, size: 36, color: AppTheme.primaryColor),
          ),
          const SizedBox(height: 16),
          const Text('Energy Intelligence AI', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text('Ask about solar and wind resource, project finance or plant health.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant, height: 1.4)),
          const SizedBox(height: 22),
          for (final p in prompts)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => _send(p),
                  style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft, padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                  child: Text(p, style: const TextStyle(fontSize: 13)),
                ),
              ),
            ),
        ]),
      ),
    );
  }

  Widget _thinking(BuildContext context) {
    return Padding(
      key: const Key('aiThinking'),
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
        const SizedBox(width: 10),
        Text('Thinking…', style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
      ]),
    );
  }

  Widget _bubble(BuildContext context, _Msg m) {
    final scheme = Theme.of(context).colorScheme;
    if (m.isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          margin: const EdgeInsets.only(bottom: 12, left: 48),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(color: AppTheme.primaryColor, borderRadius: BorderRadius.circular(14)),
          child: Text(m.text, style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.4)),
        ),
      );
    }
    if (m.error != null) return _errorCard(context, m);
    return Container(
      key: const Key('answerCard'),
      margin: const EdgeInsets.only(bottom: 14, right: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: m.structured == null ? SelectableText(cleanAnswerText(m.text), style: const TextStyle(fontSize: 14, height: 1.5)) : _answer(context, m),
    );
  }

  Widget _errorCard(BuildContext context, _Msg m) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      key: const Key('aiError'),
      margin: const EdgeInsets.only(bottom: 14, right: 24),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: scheme.errorContainer.withValues(alpha: 0.35), borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.error_outline, size: 18, color: scheme.error),
          const SizedBox(width: 6),
          Text('No answer received', style: TextStyle(fontWeight: FontWeight.w700, color: scheme.error)),
        ]),
        const SizedBox(height: 6),
        Text(m.text, style: const TextStyle(fontSize: 13, height: 1.4)),
        const SizedBox(height: 10),
        Wrap(spacing: 8, children: [
          if (m.error == 'quota')
            OutlinedButton(
              key: const Key('aiOpenPlan'),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlanUsageScreen())),
              child: const Text('View limits'),
            )
          else if (m.error == 'generic')
            FilledButton(key: const Key('aiRetry'), onPressed: _busy ? null : () => _send(m.retryText ?? ''), child: const Text('Retry')),
        ]),
      ]),
    );
  }

  Widget _label(BuildContext context, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Semantics(header: true, child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurfaceVariant))),
      );

  Widget _answer(BuildContext context, _Msg m) {
    final scheme = Theme.of(context).colorScheme;
    final s = m.structured!;
    final headline = '${s['headline'] ?? ''}'.trim();
    final numbers = [for (final n in (s['key_numbers'] as List? ?? const [])) Map<String, dynamic>.from(n as Map)];
    final basis = [for (final b in (s['basis'] as List? ?? const [])) Map<String, dynamic>.from(b as Map)];
    final risks = [for (final r in (s['risks'] as List? ?? const [])) '$r'];
    final glossary = [for (final g in (s['glossary'] as List? ?? const [])) Map<String, dynamic>.from(g as Map)];
    final limitations = [for (final l in (s['limitations'] as List? ?? const [])) '$l'];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (headline.isNotEmpty)
        Semantics(
          container: true,
          label: 'Bottom line: $headline',
          child: Container(
            key: const Key('answerHeadline'),
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: AppTheme.primaryColor.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(Icons.lightbulb_outline, size: 15, color: AppTheme.primaryColor),
                const SizedBox(width: 5),
                Text('Bottom line', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.primaryColor)),
              ]),
              const SizedBox(height: 4),
              Text(headline, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, height: 1.4)),
            ]),
          ),
        ),
      if (numbers.isNotEmpty) ...[
        _label(context, 'Key figures'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final n in numbers)
            Container(
              key: const Key('keyNumber'),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: scheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(10)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text('${n['value']}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                if ('${n['label'] ?? ''}'.isNotEmpty) Text('${n['label']}', style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
              ]),
            ),
        ]),
        const SizedBox(height: 10),
      ],
      Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          key: const Key('fullAnswer'),
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(bottom: 8),
          initiallyExpanded: headline.isEmpty,
          title: Text('Full answer', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          children: [Align(alignment: Alignment.centerLeft, child: SelectableText(cleanAnswerText(m.text), style: const TextStyle(fontSize: 14, height: 1.55)))],
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: message.isUser
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        children: [
          if (!message.isUser)
            Padding(
              padding: EdgeInsets.only(right: 8),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.smart_toy, color: Colors.white, size: 18),
              ),
            ),
          Flexible(
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: message.isUser
                    ? AppTheme.primaryColor
                    : Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: message.isUser
                  ? Text(
                      message.content,
                      style: TextStyle(fontSize: 13, color: Colors.white, height: 1.5),
                    )
                  : AiMessageBody(
                      text: message.content,
                      sources: message.sources,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: Theme.of(context).colorScheme.outlineVariant)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _messageController,
              decoration: InputDecoration(
                hintText: 'Ask a question...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
              ),
              enabled: !_isProcessing,
            ),
          ),
          SizedBox(width: 8),
          FloatingActionButton(
            mini: true,
            onPressed: _isProcessing
                ? null
                : () => _sendMessage(_messageController.text),
            child: Icon(Icons.send),
          ),
        ],
      ),
      _label(context, 'Basis'),
      if (basis.isEmpty)
        Text('This answer cites no source from our library. Check any figures yourself.', key: const Key('noBasis'), style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant, height: 1.4))
      else
        for (final b in basis)
          Padding(
            key: const Key('basisItem'),
            padding: const EdgeInsets.only(bottom: 6),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('[${b['ref']}] ${b['title'] ?? ''}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              Text([for (final k in ['publisher', 'published_at']) if ('${b[k] ?? ''}'.isNotEmpty) '${b[k]}'].join(' · '),
                  style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
              if ('${b['url'] ?? ''}'.isNotEmpty) SelectableText('${b['url']}', style: TextStyle(fontSize: 11, color: AppTheme.primaryColor)),
            ]),
          ),
      if (risks.isNotEmpty) ...[
        const SizedBox(height: 8),
        Container(
          key: const Key('risksCard'),
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppTheme.warningColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.warning_amber_rounded, size: 16, color: AppTheme.warningColor),
              const SizedBox(width: 5),
              Text('Risks', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 4),
            for (final r in risks) Padding(padding: const EdgeInsets.only(top: 3), child: Text('• $r', style: const TextStyle(fontSize: 13, height: 1.4))),
          ]),
        ),
      ],
      if (glossary.isNotEmpty) ...[
        const SizedBox(height: 12),
        _label(context, 'Terms explained'),
        Wrap(spacing: 8, runSpacing: 4, children: [
          for (final g in glossary)
            ActionChip(
              key: Key('term_${g['term']}'),
              label: Text('${g['term']}'),
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                builder: (_) => SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${g['term']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Text('${g['plain']}', style: const TextStyle(fontSize: 14, height: 1.5)),
                    ]),
                  ),
                ),
              ),
            ),
        ]),
      ],
      const SizedBox(height: 10),
      Text(limitations.isNotEmpty ? limitations.first : 'AI-generated content is for checking only. Verify key figures yourself.', style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant, height: 1.4)),
    ]);
  }

  Widget _input(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: Theme.of(context).colorScheme.outlineVariant))),
      child: Row(children: [
        Expanded(
          child: TextField(
            key: const Key('aiInput'),
            controller: _controller,
            enabled: !_busy,
            minLines: 1,
            maxLines: 4,
            textInputAction: TextInputAction.send,
            onSubmitted: _send,
            decoration: InputDecoration(
              hintText: 'Ask a question…',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
          ),
        ),
        const SizedBox(width: 8),
        IconButton.filled(
          key: const Key('aiSend'),
          tooltip: 'Send',
          onPressed: _busy ? null : () => _send(_controller.text),
          icon: const Icon(Icons.send),
        ),
      ]),
    );
  }
}
