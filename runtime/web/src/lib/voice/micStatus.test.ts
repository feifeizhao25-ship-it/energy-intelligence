import { MIC_UNSUPPORTED, micFailureMessage, micView } from './micStatus';

describe('话筒：不支持时隐藏，失败时可见提示（音3）', () => {
  it('不支持语音识别时不显示话筒', () => {
    expect(micView(MIC_UNSUPPORTED)).toEqual({ hidden: true, visibleHint: null });
  });
  it('权限被拒、连不通、没有麦克风时有可见文字', () => {
    expect(micView(micFailureMessage('not-allowed'))).toEqual({ hidden: false, visibleHint: '需要麦克风权限才能把您说的话填进输入框' });
    expect(micFailureMessage('network')).toMatch(/连不上/);
    expect(micFailureMessage('audio-capture')).toMatch(/没有检测到麦克风/);
    expect(micFailureMessage('language-not-supported')).toMatch(/键盘输入/);
    expect(micFailureMessage('whatever')).toMatch(/再试一次/);
  });
  it('用户自己停止或没说话不算失败', () => {
    expect(micFailureMessage('aborted')).toBeNull();
    expect(micFailureMessage('no-speech')).toBeNull();
    expect(micView(null)).toEqual({ hidden: false, visibleHint: null });
  });
});
