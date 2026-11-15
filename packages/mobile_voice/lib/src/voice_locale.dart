/// Locale ids for the OS speech recognizer and the OS text-to-speech engine.
class VoiceLocale {
  const VoiceLocale({required this.recognitionId, required this.ttsLanguage});

  /// BCP-47 id with an underscore, as `speech_to_text` expects (`zh_CN`).
  final String recognitionId;

  /// BCP-47 id with a hyphen, as `flutter_tts` expects (`zh-CN`).
  final String ttsLanguage;

  static const chinese = VoiceLocale(recognitionId: 'zh_CN', ttsLanguage: 'zh-CN');
  static const english = VoiceLocale(recognitionId: 'en_US', ttsLanguage: 'en-US');
}

/// Joins text already in the composer with the current recognition hypothesis.
/// Partials replace the hypothesis; they do not stack on top of each other.
String composeDictation(String base, String heard) {
  final kept = base.trimRight();
  final words = heard.trim();
  if (words.isEmpty) return kept;
  if (kept.isEmpty) return words;
  return '$kept $words';
}
