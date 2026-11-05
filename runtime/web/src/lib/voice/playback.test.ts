import { UtterancePlayback, speakableText, type Synth } from './playback';

// Test note: tap starts readout of an answer bubble; a second tap on the same
// bubble stops it. Markdown is stripped before speech. No network speech API.

class FakeSynth implements Synth {
  spoken: string[] = [];
  cancelled = 0;
  private end: (() => void) | null = null;

  speak(text: string, lang: string, onend: () => void) {
    this.spoken.push(`${lang}:${text}`);
    this.end = onend;
  }

  cancel() {
    this.cancelled += 1;
    this.end = null;
  }

  finish() {
    this.end?.();
  }
}

describe('on-device answer readout', () => {
  it('strips markdown before speaking', () => {
    expect(speakableText('### 结论\n**8.5%** 见 [依据](https://example.com)')).toBe('结论 8.5% 见 依据');
  });

  it('plays one bubble and stops on the second tap', () => {
    const synth = new FakeSynth();
    const playback = new UtterancePlayback(synth);
    expect(playback.toggle('a1', '内部收益率约 8.5%。', 'zh-CN')).toBe('playing');
    expect(synth.spoken).toEqual(['zh-CN:内部收益率约 8.5%。']);
    expect(playback.toggle('a1', '内部收益率约 8.5%。', 'zh-CN')).toBe('stopped');
    expect(playback.speakingId).toBeNull();
    expect(synth.cancelled).toBe(1);
  });

  it('switches to another bubble instead of overlapping', () => {
    const synth = new FakeSynth();
    const playback = new UtterancePlayback(synth);
    playback.toggle('a1', '第一段', 'zh-CN');
    playback.toggle('a2', '第二段', 'zh-CN');
    expect(playback.speakingId).toBe('a2');
    expect(synth.cancelled).toBe(1);
    expect(synth.spoken[1]).toBe('zh-CN:第二段');
  });
});
