import { createClient } from '@supabase/supabase-js';

/**
 * 国内版不接境外托管数据库（2026-09-21 定的口径：国内只接国内的模型和数据库）。
 *
 * Supabase 托管在境外。国内版用户数据落到境外会触发 PIPL 的数据出境规则
 * （安全评估 / 标准合同 / 认证，三选一），不是配一个环境变量能解决的；
 * 而且 supabase.co 在境内网络上本来就不稳定。
 *
 * 在此之前 `docker-compose.cn.production.yml` 把
 * NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY 三个都写成
 * `:?required`——**没有 Supabase，国内栈根本起不来**。
 *
 * 这里刻意**不在模块顶层 throw**：那样会让整个 next build 挂掉，
 * 而这个文件里大部分导出（类型定义）本来就与运行时无关。
 * 改成在真正要访问 Supabase 的那一刻拒绝——谁还在用它，
 * 会以一条说清楚原因的报错暴露出来，而不是静默连上境外服务。
 *
 * 排查还剩哪些地方在用：
 *     python3 scripts/check_domestic_stack.py --source-roots runtime/web/src
 */
const IS_DOMESTIC_EDITION = process.env.NEXT_PUBLIC_APP_EDITION === 'cn';

function assertOffshoreDataAllowed(operation: string): void {
    if (IS_DOMESTIC_EDITION) {
        throw new Error(
            `国内版不接境外托管数据库：${operation} 试图访问 Supabase。` +
                '请改用自建 PostgreSQL（Prisma / NextAuth 已经走的是它）。'
        );
    }
}

const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.invalid';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'not-configured';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!hasSupabaseConfig && !IS_DOMESTIC_EDITION) {
    console.warn('Supabase credentials missing. Some features may not work.');
}

// 客户端实例 - 用于前端，使用 anon key
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 服务端实例 - 用于后端 API，使用 service role key（绕过 RLS）
const configuredSupabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        }
    })
    : null;

export const requireSupabaseAdmin = () => {
    assertOffshoreDataAllowed('requireSupabaseAdmin');
    if (!configuredSupabaseAdmin) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY 未配置，服务端数据操作已拒绝');
    }
    return configuredSupabaseAdmin;
};

// 获取当前用户
export const getCurrentUser = async () => {
    assertOffshoreDataAllowed('getCurrentUser');
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

// 发送登录验证码
export const sendLoginCode = async (phone: string) => {
    void phone;
    throw new Error('短信服务尚未配置，验证码未生成、未保存且未发送');
};

// 验证登录码
export const verifyLoginCode = async (phone: string, code: string) => {
    assertOffshoreDataAllowed('verifyLoginCode');
    const supabaseAdmin = requireSupabaseAdmin();
    const { data, error } = await supabaseAdmin
        .from('verification_codes')
        .select('*')
        .eq('phone', phone)
        .eq('code', code)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        return { valid: false, error: '验证码无效或已过期' };
    }

    // 标记验证码为已使用
    await supabaseAdmin
        .from('verification_codes')
        .update({ used: true })
        .eq('id', data.id);

    return { valid: true };
};
