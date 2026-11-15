import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_voice/mobile_voice.dart';

// Test note: dictation appends beside existing composer text, and the speaker
// toggles play then stop for one bubble. No device recognizer is required.

class _Dictation implements VoiceDictation {
  @override
  bool isListening = false;
  String? localeId;

  @override
  Future<bool> start({
    required String localeId,
    required void Function(String text) onText,
    void Function()? onDone,
    void Function(String code)? onError,
  }) async {
    this.localeId = localeId;
    isListening = true;
    onText('光伏');
    return true;
  }

  @override
  Future<void> stop() async {
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
    events.add('speak:$language:$text');
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
  test('composeDictation replaces the live hypothesis and keeps typed text', () {
    expect(composeDictation('', '光伏'), '光伏');
    expect(composeDictation('已有问题', '光伏'), '已有问题 光伏');
    expect(composeDictation('已有问题', '   '), '已有问题');
  });

  testWidgets('mic writes into the field and the speaker toggles', (t) async {
    final controller = TextEditingController(text: '已有');
    addTearDown(controller.dispose);
    final voice = VoiceIo(dictation: _Dictation(), speaker: _Speaker());
    await t.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Column(children: [
          VoiceMicButton(
            controller: controller,
            locale: VoiceLocale.chinese,
            voice: voice,
            startLabel: '语音输入',
            stopLabel: '停止语音',
            deniedMessage: '需要麦克风权限',
            unavailableMessage: '无法使用语音输入',
          ),
          SpeakAloudButton(
            utteranceId: 'a1',
            text: '内部收益率约 8.5%。',
            locale: VoiceLocale.chinese,
            voice: voice,
            playLabel: '朗读',
            stopLabel: '停止朗读',
          ),
        ]),
      ),
    ));

    expect(find.byIcon(Icons.mic_rounded), findsOneWidget);
    await t.tap(find.byTooltip('语音输入'));
    await t.pump();
    expect(controller.text, '已有 光伏');
    expect(find.byIcon(Icons.stop_rounded), findsOneWidget);

    await t.tap(find.byTooltip('朗读'));
    await t.pump();
    final speaker = voice.speaker as _Speaker;
    expect(speaker.events.last, 'speak:zh-CN:内部收益率约 8.5%。');
    expect(find.byIcon(Icons.stop_rounded), findsNWidgets(2));

    await t.tap(find.byTooltip('停止朗读'));
    await t.pump();
    expect(speaker.events.last, 'stop');
    expect(find.byIcon(Icons.volume_up_rounded), findsOneWidget);
  });
}
