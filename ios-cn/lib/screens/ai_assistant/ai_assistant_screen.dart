import 'package:flutter/material.dart';
import 'package:mobile_voice/mobile_voice.dart';

import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/photo_widgets.dart';
import '../settings/plan_usage_screen.dart';
import '../../widgets/reading_column.dart';

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
  /// `{status, source_count}` from the server: sourced | no_source | no_source_refused. Shown above the answer.
  final Map<String, dynamic>? grounding;
  final Map<String, dynamic>? timeCheck;
  final String? error; // generic | quota | login
  final String? retryText;
  const _Msg({required this.text, required this.isUser, this.structured, this.grounding, this.timeCheck, this.error, this.retryText});
}

class AiAssistantScreen extends StatefulWidget {
  final AiChatFn? chat;
  final VoiceIo? voice;
  const AiAssistantScreen({super.key, this.chat, this.voice});

  @override
  State<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends State<AiAssistantScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  final List<_Msg> _messages = [];
  bool _busy = false;
  String _style = 'plain';

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
      final grounding = result['grounding'];
      final timeCheck = result['time_check'];
      setState(() {
        _messages.add(_Msg(
          text: answer,
          isUser: false,
          structured: structured is Map ? Map<String, dynamic>.from(structured) : null,
          grounding: grounding is Map ? Map<String, dynamic>.from(grounding) : null,
          timeCheck: timeCheck is Map ? Map<String, dynamic>.from(timeCheck) : null,
        ));
        _busy = false;
      });
    } catch (e) {
      if (!mounted) return;
      final status = e is ApiException ? e.statusCode : 0;
      setState(() {
        _messages.add(_Msg(
          text: status == 429 ? '今日 AI 提问次数已用完。可明天再试，或在“会员权益与用量”里查看额度。' : status == 401 ? '登录已过期，请重新登录。' : '网络或服务暂时不可用，你的问题已保留，可以重试。',
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
      appBar: AppBar(title: const Text('AI助手')),
      body: ReadingColumn(child: SafeArea(
        child: Column(children: [
          _styleBar(context),
          Expanded(
            child: _messages.isEmpty
                ? _empty(context)
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    itemCount: _messages.length + (_busy ? 1 : 0),
                    itemBuilder: (context, i) => i == _messages.length ? _thinking(context) : _bubble(context, _messages[i], i),
                  ),
          ),
          _input(context),
        ]),
      )),
    );
  }

  Widget _styleBar(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(children: [
        Text('回答风格', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
        const SizedBox(width: 10),
        Expanded(
          child: Semantics(
            container: true,
            label: '回答风格',
            child: SegmentedButton<String>(
              key: const Key('styleSwitch'),
              showSelectedIcon: false,
              style: const ButtonStyle(visualDensity: VisualDensity.compact),
              segments: const [
                ButtonSegment(value: 'plain', label: Text('大白话')),
                ButtonSegment(value: 'pro', label: Text('专业')),
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
    final prompts = const ['查询光伏资源潜力', '内部收益率是什么意思', '储能为什么能赚钱'];
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const EnBanner(
            asset: 'assets/images/en_ai_control.webp',
            caption: '新能源智库AI助手',
            chips: [(Icons.wb_sunny_outlined, '光伏风电'), (Icons.trending_up, '收益测算'), (Icons.battery_charging_full_outlined, '储能')],
            height: 150,
          ),
          const SizedBox(height: 14),
          Text('有什么我可以帮助的吗？', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant, height: 1.4)),
          const SizedBox(height: 22),
          for (final p in prompts)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => _send(p),
                  style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft, padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                  child: Row(children: [
                    Icon(prompts.indexOf(p) == 0 ? Icons.wb_sunny_outlined : (prompts.indexOf(p) == 1 ? Icons.trending_up : Icons.battery_charging_full_outlined), size: 18, color: AppTheme.primaryColor),
                    const SizedBox(width: 10),
                    Expanded(child: Text(p, style: const TextStyle(fontSize: 14, height: 1.4))),
                  ]),
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
        Text('正在思考…', style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
      ]),
    );
  }

  String _speakable(_Msg m) {
    final body = cleanAnswerText(m.text);
    final headline = m.structured == null ? '' : '${m.structured!['headline'] ?? ''}'.trim();
    if (headline.isEmpty || body.contains(headline)) return body;
    if (body.isEmpty) return headline;
    return '$headline\n$body';
  }

  Widget _speaker(_Msg m, int index) {
    return Align(
      alignment: Alignment.centerRight,
      child: SpeakAloudButton(
        key: const Key('voiceSpeak'),
        utteranceId: 'a$index',
        text: _speakable(m),
        locale: VoiceLocale.chinese,
        voice: widget.voice,
        playLabel: '朗读',
        stopLabel: '停止朗读',
      ),
    );
  }

  Widget _bubble(BuildContext context, _Msg m, int index) {
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
    if (m.error != null) return _errorCard(context, m, index);
    return Container(
      key: const Key('answerCard'),
      margin: const EdgeInsets.only(bottom: 14, right: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Material(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // The grounding status comes first, not as a footnote: the reader must know whether anything backs the answer.
        if (m.grounding != null) _groundingBanner(context, m.grounding!),
        if (_expiredDates(m).isNotEmpty) _dateCheckBanner(context, _expiredDates(m), m.timeCheck?['today']),
        _speaker(m, index),
        m.structured == null ? SelectableText(cleanAnswerText(m.text), style: const TextStyle(fontSize: 14, height: 1.5)) : _answer(context, m),
          ]),
        ),
      ),
    );
  }

  List<String> _expiredDates(_Msg m) {
    final list = m.timeCheck?['expired_dates'];
    if (list is! List) return const [];
    return [for (final e in list) if (e is Map && e['date'] != null) '${e['date']}'];
  }

  Widget _dateCheckBanner(BuildContext context, List<String> dates, Object? today) {
    final scheme = Theme.of(context).colorScheme;
    final text = '日期核对：${dates.join('、')} 已经过去（今天是 $today），不要当作未来的截止日期。';
    return Container(
      key: const Key('dateCheck'),
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(color: scheme.error.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(10)),
      child: Row(children: [
        Icon(Icons.event_busy, size: 16, color: scheme.error),
        const SizedBox(width: 6),
        Expanded(child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: scheme.error, height: 1.3))),
      ]),
    );
  }

  Widget _groundingBanner(BuildContext context, Map<String, dynamic> g) {
    final scheme = Theme.of(context).colorScheme;
    final status = '${g['status'] ?? ''}';
    final n = (g['source_count'] is num) ? (g['source_count'] as num).toInt() : 0;
    final String text;
    final IconData icon;
    final Color color;
    if (status == 'sourced') {
      text = '依据资料库 $n 条来源';
      icon = Icons.verified_outlined;
      color = scheme.primary;
    } else if (status == 'no_source_refused') {
      text = '未作答：资料库没有收录这个问题的来源。';
      icon = Icons.block;
      color = scheme.error;
    } else {
      text = '这条回答没有资料库来源，请自行核对数据。';
      icon = Icons.info_outline;
      color = scheme.tertiary;
    }
    return Container(
      key: const Key('groundingStatus'),
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(10)),
      child: Row(children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Expanded(child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color, height: 1.3))),
      ]),
    );
  }

  Widget _errorCard(BuildContext context, _Msg m, int index) {
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
          Text('没有拿到回答', style: TextStyle(fontWeight: FontWeight.w700, color: scheme.error)),
        ]),
        const SizedBox(height: 6),
        Text(m.text, style: const TextStyle(fontSize: 13, height: 1.4)),
        _speaker(m, index),
        const SizedBox(height: 10),
        Wrap(spacing: 8, children: [
          if (m.error == 'quota')
            OutlinedButton(
              key: const Key('aiOpenPlan'),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlanUsageScreen())),
              child: const Text('查看额度'),
            )
          else if (m.error == 'generic')
            FilledButton(key: const Key('aiRetry'), onPressed: _busy ? null : () => _send(m.retryText ?? ''), child: const Text('重试')),
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
          label: '一句话结论: $headline',
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
                Text('一句话结论', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.primaryColor)),
              ]),
              const SizedBox(height: 4),
              Text(headline, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, height: 1.4)),
            ]),
          ),
        ),
      if (numbers.isNotEmpty) ...[
        _label(context, '关键数字'),
        // Wrap keeps Key('keyNumber') for layout checks. Each chip needs its own key:
        // a shared Key('keyNumber') throws once a reply has two figures, and this card
        // (speaker included) never finishes building.
        Wrap(
          key: const Key('keyNumber'),
          spacing: 8,
          runSpacing: 8,
          children: [
            for (var i = 0; i < numbers.length; i++)
              Container(
                key: Key('keyNumber_$i'),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: scheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(10)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text('${numbers[i]['value']}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  if ('${numbers[i]['label'] ?? ''}'.isNotEmpty) Text('${numbers[i]['label']}', style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
                ]),
              ),
          ],
        ),
        const SizedBox(height: 10),
      ],
      Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          key: const Key('fullAnswer'),
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(bottom: 8),
          initiallyExpanded: headline.isEmpty,
          title: Text('完整回答', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          children: [Align(alignment: Alignment.centerLeft, child: SelectableText(cleanAnswerText(m.text), style: const TextStyle(fontSize: 14, height: 1.55)))],
        ),
      ),
      _label(context, '依据'),
      if (basis.isEmpty)
        Text('本回答没有引用资料库中的来源，请自行核对其中的数字。', key: const Key('noBasis'), style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant, height: 1.4))
      else
        for (var i = 0; i < basis.length; i++)
          Padding(
            key: Key('basisItem_$i'),
            padding: const EdgeInsets.only(bottom: 6),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('[${basis[i]['ref']}] ${basis[i]['title'] ?? ''}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              Text([for (final k in ['publisher', 'published_at']) if ('${basis[i][k] ?? ''}'.isNotEmpty) '${basis[i][k]}'].join(' · '),
                  style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
              if ('${basis[i]['url'] ?? ''}'.isNotEmpty) SelectableText('${basis[i]['url']}', style: TextStyle(fontSize: 11, color: AppTheme.primaryColor)),
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
              Text('风险提示', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 4),
            for (final r in risks) Padding(padding: const EdgeInsets.only(top: 3), child: Text('• $r', style: const TextStyle(fontSize: 13, height: 1.4))),
          ]),
        ),
      ],
      if (glossary.isNotEmpty) ...[
        const SizedBox(height: 12),
        _label(context, '名词解释'),
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
      Text(limitations.isNotEmpty ? limitations.first : 'AI 生成内容仅供辅助核对，关键数据请人工复核。', style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant, height: 1.4)),
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
              hintText: '输入问题…',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
          ),
        ),
        const SizedBox(width: 4),
        VoiceMicButton(
          key: const Key('voiceMic'),
          controller: _controller,
          enabled: !_busy,
          locale: VoiceLocale.chinese,
          voice: widget.voice,
          startLabel: '语音输入',
          stopLabel: '停止语音',
          deniedMessage: '需要麦克风和语音识别权限，才能把您说的话填进输入框。请在系统设置里允许。',
          unavailableMessage: '当前设备无法使用语音输入，请改用键盘。',
        ),
        IconButton.filled(
          key: const Key('aiSend'),
          tooltip: '发送',
          onPressed: _busy ? null : () => _send(_controller.text),
          icon: const Icon(Icons.send),
        ),
      ]),
    );
  }
}
