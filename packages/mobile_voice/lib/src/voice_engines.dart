import 'package:flutter/foundation.dart';

/// Turns speech into text. Implementations must prefer on-device recognition.
abstract class VoiceDictation {
  bool get isListening;

  /// [onText] receives the full hypothesis for this session, not a delta.
  /// [onError] codes are `denied` and `unavailable` (silence is not an error).
  Future<bool> start({
    required String localeId,
    required void Function(String text) onText,
    void Function()? onDone,
    void Function(String code)? onError,
  });

  Future<void> stop();
}

/// Speaks one utterance at a time. A second call replaces the first.
abstract class VoiceSpeaker extends ChangeNotifier {
  bool get isSpeaking;
  String? get activeId;

  Future<void> speak(String id, String text, {required String language});
  Future<void> stop();
}

/// The dictation and readout pair a chat surface uses.
class VoiceIo {
  const VoiceIo({required this.dictation, required this.speaker});

  final VoiceDictation dictation;
  final VoiceSpeaker speaker;

  static VoiceIo? _platform;

  /// OS speech services. Created on first use so widget tests that inject a
  /// [VoiceIo] never touch the platform channels.
  static VoiceIo get platform => _platform ??= VoiceIo(
        dictation: createPlatformDictation(),
        speaker: createPlatformSpeaker(),
      );
}

/// Wired by `platform_voice.dart` so this library stays free of plugin imports
/// until a real session starts. Tests never call it.
VoiceDictation Function() createPlatformDictation = _missingDictation;
VoiceSpeaker Function() createPlatformSpeaker = _missingSpeaker;

VoiceDictation _missingDictation() => throw StateError('Platform dictation is not linked');
VoiceSpeaker _missingSpeaker() => throw StateError('Platform speaker is not linked');
