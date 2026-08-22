import { createClient } from '@supabase/supabase-js';

const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.invalid';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'not-configured';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!hasSupabaseConfig) {
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
    if (!configuredSupabaseAdmin) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY 未配置，服务端数据操作已拒绝');
    }
    return configuredSupabaseAdmin;
};

// 获取当前用户
export const getCurrentUser = async () => {
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
