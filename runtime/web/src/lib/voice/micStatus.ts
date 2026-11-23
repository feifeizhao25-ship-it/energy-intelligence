/**
 * 话筒状态（音3，2026-11-23）：浏览器不支持语音识别时不显示话筒；识别失败或没有权限时在话筒旁显示一行字，
 * 不再只写在 title / aria-label 里（手机上看不到）。
 */
export const MIC_UNSUPPORTED = '当前浏览器不支持语音输入';

export function micFailureMessage(code: string): string | null {
  switch (code) {
    case 'aborted':
    case 'no-speech':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return '需要麦克风权限才能把您说的话填进输入框';
    case 'audio-capture':
      return '没有检测到麦克风，请改用键盘输入';
    case 'network':
      return '语音识别连不上，请改用键盘输入';
    case 'language-not-supported':
      return '这个浏览器不能识别中文语音，请改用键盘输入';
    default:
      return '没听清，请再试一次或改用键盘输入';
  }
}

/** 不支持时整个话筒不渲染；其余错误显示可见文字。 */
export function micView(error: string | null): { hidden: boolean; visibleHint: string | null } {
  if (error === MIC_UNSUPPORTED) return { hidden: true, visibleHint: null };
  return { hidden: false, visibleHint: error };
}
