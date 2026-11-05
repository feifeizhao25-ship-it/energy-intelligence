import 'package:energy_global_ios/screens/ai_assistant/ai_assistant_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_voice/mobile_voice.dart';

// Test note: on the phone assistant the mic sits in the composer row and writes
// dictated text into the field. The speaker on an answer plays that bubble and
// stops on a second tap. Fakes stand in for the on-device recognizer and TTS.

class _Dictation implements VoiceDictation {
  var stops = 0;
  @override
  bool isListening = false;

  @override
  Future<bool> start({
    required String localeId,
    required void Function(String text) onText,
    void Function()? onDone,
    void Function(String code)? onError,
  }) async {
    expect(localeId, 'en_US');
    isListening = true;
    onText('How is the solar resource');
    return true;
  }

  @override
  Future<void> stop() async {
    stops += 1;
    isListening = false;
  }
}

class _Speaker extends VoiceSpeaker {
  final events = <String>[];
  @override
  bool isSpeaking = false;
  @override
  String? activeId;

  @override
  Future<void> speak(String id, String text, {required String language}) async {
    events.add('$language:$text');
    isSpeaking = true;
    activeId = id;
    notifyListeners();
  }

  @override
  Future<void> stop() async {
    events.add('stop');
    isSpeaking = false;
    activeId = null;
    notifyListeners();
  }
}

void main() {
  testWidgets('composer mic fills the field and the answer speaker toggles', (t) async {
    final dictation = _Dictation();
    final speaker = _Speaker();
    await t.pumpWidget(MaterialApp(
      home: AiAssistantScreen(
        voice: VoiceIo(dictation: dictation, speaker: speaker),
        chat: (m, s) async => {'message': 'The IRR is about 8.5%.'},
      ),
    ));

    expect(find.byIcon(Icons.mic_rounded), findsOneWidget);
    expect(find.byTooltip('Voice input'), findsOneWidget);

    await t.tap(find.byKey(const Key('voiceMic')));
    await t.pump();
    expect(t.widget<TextField>(find.byKey(const Key('aiInput'))).controller!.text, 'How is the solar resource');

    await t.tap(find.byKey(const Key('voiceMic')));
    await t.pump();
    expect(dictation.stops, 1);

    await t.tap(find.byKey(const Key('aiSend')));
    await t.pumpAndSettle();
    expect(find.byIcon(Icons.volume_up_rounded), findsOneWidget);

    await t.tap(find.byKey(const Key('voiceSpeak')));
    await t.pump();
    expect(speaker.events.last, contains('8.5'));
    expect(speaker.events.last, startsWith('en-US:'));
    expect(find.byIcon(Icons.stop_rounded), findsOneWidget);

    await t.tap(find.byKey(const Key('voiceSpeak')));
    await t.pump();
    expect(speaker.events.last, 'stop');
    expect(find.byIcon(Icons.volume_up_rounded), findsOneWidget);
  });
}
