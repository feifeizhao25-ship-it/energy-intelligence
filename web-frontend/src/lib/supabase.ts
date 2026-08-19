import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing. Some features may not work.');
}

// 客户端实例 - 用于前端，使用 anon key
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 服务端实例 - 用于后端 API，使用 service role key（绕过 RLS）
export const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        }
    })
    : supabase;

// 获取当前用户
export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

// 发送登录验证码
export const sendLoginCode = async (phone: string) => {
    // 这里需要实现短信发送逻辑
    // 暂时使用模拟
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 保存验证码到数据库
    const { error } = await supabaseAdmin.from('verification_codes').insert({
        phone,
        code,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5分钟过期
        type: 'login',
    });

    if (error) {
        console.error('Error saving verification code:', error);
        throw error;
    }

    // 在开发环境打印验证码
    if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] Verification code for ${phone}: ${code}`);
    }

    return { success: true };
};

// 验证登录码
export const verifyLoginCode = async (phone: string, code: string) => {
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
