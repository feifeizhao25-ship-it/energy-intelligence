/**
 * 测试登录只在开发或测试构建、并且 TEST_LOGIN_ENABLED=1 时存在。
 * 正式构建（NODE_ENV=production）恒为 false，调用方不得签发会话。
 */
export function testLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    const nodeEnv = env.NODE_ENV ?? '';
    if (nodeEnv !== 'development' && nodeEnv !== 'test') return false;
    return env.TEST_LOGIN_ENABLED === '1';
}

/** 浏览器按钮用的公开开关。正式构建里 Next 会把 NODE_ENV 折成常量，按钮代码不会留下。 */
export function testLoginButtonVisible(env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.NODE_ENV === 'production') return false;
    return env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
        ? env.NEXT_PUBLIC_TEST_LOGIN_ENABLED === '1'
        : false;
}
