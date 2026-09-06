import { getRequestConfig } from 'next-intl/server';

// 国内部署不信任浏览器语言或用户可修改的语言 Cookie。
export default getRequestConfig(async () => ({
    locale: 'zh',
    messages: (await import('../messages/zh.json')).default,
}));
