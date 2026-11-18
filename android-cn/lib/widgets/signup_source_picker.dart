import 'package:flutter/material.dart';

/// 注册来源题「从哪知道我们」的一个选项（代码 + 文字）。
class SignupSourceOption {
  const SignupSourceOption(this.code, this.label);
  final String code;
  final String label;
}

/// 只保留形如 {code, label} 的选项；接口没打开（enabled 不是 true）或回了别的东西，就当没有这道题。
List<SignupSourceOption> parseSignupSourceOptions(Object? raw) {
  Object? body = raw;
  if (body is Map && body['data'] is Map) body = body['data'];
  if (body is! Map || body['enabled'] != true || body['options'] is! List) return const [];
  final out = <SignupSourceOption>[];
  for (final o in body['options'] as List) {
    if (o is Map && o['code'] is String && o['label'] is String) {
      out.add(SignupSourceOption(o['code'] as String, o['label'] as String));
    }
  }
  return out;
}

/// 只提交在选项里的代码；没选（跳过）返回 null。
String? selectedSignupSource(List<SignupSourceOption> options, String value) {
  if (value.isEmpty) return null;
  return options.any((o) => o.code == value) ? value : null;
}

/// 可跳过的单选：再点一次已选项即取消。没有选项（开关关闭或接口失败）时不显示。
class SignupSourcePicker extends StatelessWidget {
  const SignupSourcePicker({super.key, required this.options, required this.value, required this.onChanged});

  final List<SignupSourceOption> options;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    if (options.isEmpty) return const SizedBox.shrink();
    return Semantics(
      key: const Key('signup-source'),
      container: true,
      label: '从哪知道我们',
      child: Padding(
        padding: const EdgeInsets.only(top: 4, bottom: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('首次注册：从哪知道我们（选填，可跳过）', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                for (final o in options)
                  ChoiceChip(
                    key: Key('signup-source-${o.code}'),
                    label: Text(o.label, style: const TextStyle(fontSize: 12)),
                    selected: o.code == value,
                    onSelected: (_) => onChanged(o.code == value ? '' : o.code),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
