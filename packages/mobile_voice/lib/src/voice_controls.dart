import 'package:flutter/material.dart';

import 'platform_voice.dart';
import 'voice_engines.dart';
import 'voice_locale.dart';

/// Microphone for a phone chat composer.
///
/// Sits in the thumb row beside the text field. Tap starts dictation; tap
/// again stops. Partial text replaces the in-progress phrase.
class VoiceMicButton extends StatefulWidget {
  const VoiceMicButton({
    super.key,
    required this.controller,
    required this.locale,
    required this.startLabel,
    required this.stopLabel,
    required this.deniedMessage,
    required this.unavailableMessage,
    this.enabled = true,
    this.voice,
  });

  final TextEditingController controller;
  final VoiceLocale locale;
  final String startLabel;
  final String stopLabel;
  final String deniedMessage;
  final String unavailableMessage;
  final bool enabled;
  final VoiceIo? voice;

  @override
  State<VoiceMicButton> createState() => _VoiceMicButtonState();
}

class _VoiceMicButtonState extends State<VoiceMicButton> {
  var _listening = false;
  var _started = false;
  var _base = '';
  VoiceIo? _io;

  VoiceIo get _voice {
    if (widget.voice != null) return widget.voice!;
    linkPlatformVoice();
    return _io ??= VoiceIo.platform;
  }

  @override
  void dispose() {
    if (_started) {
      _voice.dictation.stop();
    }
    super.dispose();
  }

  Future<void> _toggle() async {
    if (!widget.enabled) return;
    final voice = _voice;
    if (_listening) {
      await voice.dictation.stop();
      if (mounted) setState(() => _listening = false);
      return;
    }
    await voice.speaker.stop();
    _base = widget.controller.text;
    _started = true;
    setState(() => _listening = true);
    final ok = await voice.dictation.start(
      localeId: widget.locale.recognitionId,
      onText: (words) {
        if (!mounted) return;
        final next = composeDictation(_base, words);
        widget.controller.value = TextEditingValue(
          text: next,
          selection: TextSelection.collapsed(offset: next.length),
        );
      },
      onDone: () {
        if (mounted) setState(() => _listening = false);
      },
      onError: (code) {
        if (!mounted) return;
        setState(() => _listening = false);
        final message = code == 'denied' ? widget.deniedMessage : widget.unavailableMessage;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      },
    );
    if (!ok && mounted) setState(() => _listening = false);
  }

  @override
  Widget build(BuildContext context) {
    final listening = _listening;
    final label = listening ? widget.stopLabel : widget.startLabel;
    return IconButton(
      tooltip: label,
      onPressed: widget.enabled ? _toggle : null,
      icon: Icon(
        listening ? Icons.stop_rounded : Icons.mic_rounded,
        color: listening ? Theme.of(context).colorScheme.error : null,
      ),
    );
  }
}

/// Small speaker on a chat answer. Tap speaks the bubble; tap again stops.
class SpeakAloudButton extends StatefulWidget {
  const SpeakAloudButton({
    super.key,
    required this.utteranceId,
    required this.text,
    required this.locale,
    required this.playLabel,
    required this.stopLabel,
    this.voice,
  });

  final String utteranceId;
  final String text;
  final VoiceLocale locale;
  final String playLabel;
  final String stopLabel;
  final VoiceIo? voice;

  @override
  State<SpeakAloudButton> createState() => _SpeakAloudButtonState();
}

class _SpeakAloudButtonState extends State<SpeakAloudButton> {
  VoiceIo? _io;
  var _bound = false;

  @override
  void initState() {
    super.initState();
    if (widget.voice != null) {
      widget.voice!.speaker.addListener(_onSpeaker);
      _bound = true;
    }
  }

  @override
  void dispose() {
    if (_bound) widget.voice?.speaker.removeListener(_onSpeaker);
    super.dispose();
  }

  void _onSpeaker() {
    if (mounted) setState(() {});
  }

  VoiceSpeaker? get _boundSpeaker => widget.voice?.speaker ?? _io?.speaker;

  bool get _playing {
    final speaker = _boundSpeaker;
    if (speaker == null) return false;
    return speaker.isSpeaking && speaker.activeId == widget.utteranceId;
  }

  Future<void> _toggle() async {
    final text = widget.text.trim();
    if (text.isEmpty) return;
    if (widget.voice == null) linkPlatformVoice();
    final voice = widget.voice ?? (_io ??= VoiceIo.platform);
    if (!_bound) {
      voice.speaker.addListener(_onSpeaker);
      _bound = true;
    }
    if (voice.speaker.isSpeaking && voice.speaker.activeId == widget.utteranceId) {
      await voice.speaker.stop();
      return;
    }
    await voice.dictation.stop();
    await voice.speaker.speak(widget.utteranceId, text, language: widget.locale.ttsLanguage);
  }

  @override
  Widget build(BuildContext context) {
    final playing = _playing;
    final label = playing ? widget.stopLabel : widget.playLabel;
    return IconButton(
      tooltip: label,
      visualDensity: VisualDensity.compact,
      onPressed: widget.text.trim().isEmpty ? null : _toggle,
      icon: Icon(playing ? Icons.stop_rounded : Icons.volume_up_rounded, size: 20),
    );
  }
}
