import { ASSISTANT_UNREACHABLE_ZH, visibleAssistantError } from './chat-failure';
import { modelFailureReply } from './model-failure';
import { clearLibraryCache } from './library-fallback';

beforeEach(() => clearLibraryCache());

function refused(): Error {
  const error = new TypeError('fetch failed');
  (error as { cause?: unknown }).cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8000'), { code: 'ECONNREFUSED' });
  return error;
}

test('后端连不上且资料库有命中时，返回带来源和发文日期的资料库回答', () => {
  const reply = modelFailureReply(refused(), '光伏发电站设计标准');
  expect(reply?.kind).toBe('library');
  if (reply?.kind !== 'library') return;
  expect(reply.text).toContain('未调用模型');
  expect(reply.text).toContain('发文日期：2024-03-01');
  expect(reply.sources[0]?.title).toContain('光伏发电站设计标准');
  expect(reply.text).not.toContain('未知错误');
});

test('后端连不上且资料库没有命中时，给出明确中文而不是未知错误', () => {
  const reply = modelFailureReply(refused(), '虚构县 ZZQQ-999 的区划罚则');
  expect(reply).toEqual({ kind: 'message', message: ASSISTANT_UNREACHABLE_ZH });
  expect(ASSISTANT_UNREACHABLE_ZH).not.toContain('未知错误');
});

test('模型未配置时仍走资料库回答，包括没有命中', () => {
  const hit = modelFailureReply(new Error('SILICONFLOW_API_KEY 未配置，国内 AI 服务已拒绝生成替代内容'), '新能源上网电价市场化改革 机制电价');
  expect(hit?.kind).toBe('library');
  const miss = modelFailureReply(new Error('国内 AI 服务已拒绝生成替代内容'), '虚构县 ZZQQ-999 的区划罚则');
  expect(miss?.kind).toBe('library');
  if (miss?.kind !== 'library') return;
  expect(miss.text).toContain('没有可引用的来源');
});

test('界面不展示未知错误和英文网络报错', () => {
  expect(visibleAssistantError('未知错误')).toBe(ASSISTANT_UNREACHABLE_ZH);
  expect(visibleAssistantError('fetch failed')).toBe(ASSISTANT_UNREACHABLE_ZH);
  expect(visibleAssistantError('connect ECONNREFUSED 127.0.0.1:8000')).toBe(ASSISTANT_UNREACHABLE_ZH);
  expect(visibleAssistantError('SILICONFLOW_API_KEY 未配置')).toBe('AI 服务暂时不可用，请稍后再试');
  expect(visibleAssistantError('今日 AI 次数已用完（5 次），明天恢复或升级会员')).toBe('今日 AI 次数已用完（5 次），明天恢复或升级会员');
});
