import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_to_text.dart';

import 'voice_engines.dart';

/// Links the OS speech recognizer and the OS speech synthesizer.
///
/// Recognition asks for on-device first (`SpeechListenOptions.onDevice`).
/// If that session does not start, one retry uses the platform recognizer.
/// Neither path uses an app-held API key or a project secret.
void linkPlatformVoice() {
  createPlatformDictation = PlatformVoiceDictation.new;
  createPlatformSpeaker = PlatformVoiceSpeaker.new;
}

class PlatformVoiceDictation implements VoiceDictation {
  SpeechToText? _speech;
  var _ready = false;
  var _listening = false;
  void Function(String text)? _onText;
  void Function()? _onDone;
  void Function(String code)? _onError;

  SpeechToText get _engine => _speech ??= SpeechToText();

  @override
  bool get isListening => _listening;

  Future<bool> _ensure() async {
    if (_ready) return true;
    _ready = await _engine.initialize(
      onError: (error) {
        final msg = error.errorMsg;
        if (msg == 'error_no_match' || msg == 'error_speech_timeout') {
          _finish();
          return;
        }
        if (msg.contains('permission')) {
          _onError?.call('denied');
        } else {
          _onError?.call('unavailable');
        }
        _finish();
      },
      onStatus: (status) {
        if (status == 'done' || status == 'notListening') _finish();
      },
    );
    return _ready;
  }

  void _finish() {
    if (!_listening) return;
    _listening = false;
    _onDone?.call();
  }

  Future<bool> _listen(String localeId, {required bool onDevice}) async {
    await _engine.listen(
      onResult: (result) {
        final words = result.recognizedWords.trim();
        if (words.isNotEmpty) _onText?.call(words);
      },
      listenOptions: SpeechListenOptions(
        onDevice: onDevice,
        partialResults: true,
        listenMode: ListenMode.dictation,
        cancelOnError: false,
        autoPunctuation: true,
        pauseFor: const Duration(seconds: 3),
        listenFor: const Duration(seconds: 45),
        localeId: localeId,
      ),
    );
    return _engine.isListening;
  }

  @override
  Future<bool> start({
    required String localeId,
    required void Function(String text) onText,
    void Function()? onDone,
    void Function(String code)? onError,
  }) async {
    _onText = onText;
    _onDone = onDone;
    _onError = onError;
    if (!await _ensure()) {
      final allowed = await _engine.hasPermission;
      onError?.call(allowed ? 'unavailable' : 'denied');
      return false;
    }
    var started = false;
    try {
      started = await _listen(localeId, onDevice: true);
    } catch (_) {
      started = false;
    }
    if (!started) {
      try {
        await _engine.stop();
      } catch (_) {}
      try {
        started = await _listen(localeId, onDevice: false);
      } catch (_) {
        started = false;
      }
    }
    _listening = started;
    if (!started) onError?.call('unavailable');
    return started;
  }

  @override
  Future<void> stop() async {
    _listening = false;
    if (_speech == null) return;
    try {
      await _engine.stop();
    } catch (_) {}
  }
}

class PlatformVoiceSpeaker extends VoiceSpeaker {
  FlutterTts? _tts;
  var _speaking = false;
  String? _activeId;
  String? _language;

  @override
  bool get isSpeaking => _speaking;

  @override
  String? get activeId => _activeId;

  Future<FlutterTts> _engineFor(String language) async {
    final tts = _tts ??= FlutterTts();
    await tts.awaitSpeakCompletion(true);
    await tts.setVolume(1.0);
    await tts.setSpeechRate(0.5);
    if (_language != language) {
      await tts.setLanguage(language);
      _language = language;
    }
    tts.setCompletionHandler(_clear);
    tts.setCancelHandler(_clear);
    tts.setErrorHandler((_) => _clear());
    return tts;
  }

  void _clear() {
    if (!_speaking && _activeId == null) return;
    _speaking = false;
    _activeId = null;
    notifyListeners();
  }

  @override
  Future<void> speak(String id, String text, {required String language}) async {
    final spoken = text.trim();
    if (spoken.isEmpty) return;
    if (_speaking) await stop();
    final tts = await _engineFor(language);
    _speaking = true;
    _activeId = id;
    notifyListeners();
    final clipped = spoken.length > 3500 ? spoken.substring(0, 3500) : spoken;
    await tts.speak(clipped);
  }

  @override
  Future<void> stop() async {
    _speaking = false;
    _activeId = null;
    notifyListeners();
    final tts = _tts;
    if (tts == null) return;
    try {
      await tts.stop();
    } catch (_) {}
  }
}
