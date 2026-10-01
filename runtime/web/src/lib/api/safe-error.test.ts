import { safeErrorMessage } from './safe-error';

const FB = '服务暂时不可用，请稍后再试';

describe('safeErrorMessage', () => {
  it('自己写的中文业务错误原样给用户', () => {
    expect(safeErrorMessage(new Error('请提供手机号和验证码'), FB)).toBe('请提供手机号和验证码');
    expect(safeErrorMessage('团队下还有成员，无法注销', FB)).toBe('团队下还有成员，无法注销');
  });

  it.each([
    'fetch failed',
    'HTTP 401',
    'Request failed with status code 502',
    'connect ECONNREFUSED 127.0.0.1:5432',
    '\nInvalid `prisma.user.findMany()` invocation:\n表 users 不存在',
    '调用失败 Error: HTTP 500 at fetchIt (node_modules/x/index.js:10:5)',
    '上游返回 HTTP 403',
  ])('英文/内部报错（%s）换成兜底中文', (m) => {
    expect(safeErrorMessage(new Error(m), FB)).toBe(FB);
  });

  it('不是 Error、空消息、过长消息都走兜底', () => {
    expect(safeErrorMessage(undefined, FB)).toBe(FB);
    expect(safeErrorMessage({ message: '中文' }, FB)).toBe(FB);
    expect(safeErrorMessage(new Error(''), FB)).toBe(FB);
    expect(safeErrorMessage(new Error('错'.repeat(300)), FB)).toBe(FB);
  });
});
