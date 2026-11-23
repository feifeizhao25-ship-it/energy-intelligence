import { UtterancePlayback, speakableText, spokenAnswerText, classifySpeechError, speakFailureMessage, type Synth, type SpeakFailure } from './playback';

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

describe('朗读只读正文、失败可见（音1、音2，2026-11-23）', () => {
  it('来源块不进朗读，只提一句条数；网址和角标不读', () => {
    const body = '136 号文之后新建项目按市场化方式形成上网电价 [1]。详见 https://www.ndrc.gov.cn/x.html';
    const text = spokenAnswerText(body, 4);
    expect(text).toBe('136 号文之后新建项目按市场化方式形成上网电价。详见 （网址见屏幕） 本回答附 4 条来源，请看屏幕。');
    expect(text).not.toMatch(/许可|发布机构|https?:/);
    expect(spokenAnswerText('只有正文')).toBe('只有正文');
    expect(spokenAnswerText('', 3)).toBe('');
  });

  it('引擎失败时记下原因，按钮旁有文字；用户停止不算失败', () => {
    let end: ((f?: SpeakFailure) => void) | null = null;
    const synth: Synth = { speak: (_t, _l, onend) => { end = onend; }, cancel: () => { end = null; } };
    const playback = new UtterancePlayback(synth);
    playback.toggle('a1', '正文', 'zh-CN');
    end!('no-voice');
    expect(playback.speakingId).toBeNull();
    expect(playback.lastError).toEqual({ id: 'a1', message: '本机没有可用的中文语音，无法朗读' });
    playback.toggle('a1', '正文', 'zh-CN');
    expect(playback.lastError).toBeNull(); // 重试时清掉
    end!();
    expect(playback.lastError).toBeNull();
  });

  it('浏览器错误码分类', () => {
    expect(classifySpeechError('interrupted')).toBeUndefined();
    expect(classifySpeechError('canceled')).toBeUndefined();
    expect(classifySpeechError('language-unavailable')).toBe('no-voice');
    expect(classifySpeechError('voice-unavailable')).toBe('no-voice');
    expect(classifySpeechError('not-allowed')).toBe('not-allowed');
    expect(classifySpeechError('synthesis-failed')).toBe('error');
    expect(speakFailureMessage('unsupported')).toBe('这个浏览器不支持朗读');
  });
});
