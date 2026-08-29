import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
    // 从 Cookie 读取 locale
    let locale = 'zh';

    try {
        const cookieStore = await cookies();
        const nextLocale = cookieStore.get('NEXT_LOCALE');
        if (nextLocale?.value && ['en', 'zh'].includes(nextLocale.value)) {
            locale = nextLocale.value;
        }
    } catch (e) {
        // 在某些服务端组件中可能无法访问 cookies
        locale = 'zh';
    }

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default
    };
});
