import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { executeTool } from '@/lib/ai/tool-executor';
import { isToolAllowed, getToolDefinition } from '@/lib/audit/tool-whitelist';

/**
 * AI 工具统一调用入口。
 *
 * 这个路由此前**不存在**，而工具执行器（`lib/ai/tool-executor.ts`，
 * 已实现 40+ 个工具）和白名单（`lib/audit/tool-whitelist.ts`）都是齐的 ——
 * 缺的只是把它们暴露出来。
 *
 * `components/dashboard/site-wizard/SiteWizard.tsx` 一直在打它，
 * 用于 `explain_site_recommendation`（选址解释）与 `geocode_address`（地址解析）。
 * 404 之后，前端 `setAiExplanation(aiData.output || aiData)` 会把
 * Next.js 的 404 页面对象直接当成解释渲染出去。
 *
 * 白名单是**必须**的一道闸：executeTool 是个大 switch，
 * 直接把 toolName 透传进去等于把内部所有工具（含写操作）对外开放。
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            // 工具会消耗 AI 额度与第三方 API 配额，必须登录
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const toolName = String(body?.toolName ?? '');
        const toolInput = (body?.toolInput ?? {}) as Record<string, unknown>;

        if (!toolName) {
            return NextResponse.json({ error: '缺少 toolName' }, { status: 400 });
        }

        // 白名单校验。注意：白名单里没登记的工具即便执行器支持也一律拒绝 ——
        // 宁可少开一个功能，也不要把 switch 里的写操作暴露成公开接口。
        if (!isToolAllowed(toolName)) {
            return NextResponse.json(
                {
                    error: `工具未授权: ${toolName}`,
                    code: 'TOOL_NOT_ALLOWED',
                },
                { status: 403 },
            );
        }

        const definition = getToolDefinition(toolName);

        // 高风险 / 需确认的工具不走这个通用入口 ——
        // 它没有确认流程，放行等于绕过确认。
        if (definition?.requiresConfirmation) {
            return NextResponse.json(
                {
                    error: `工具 ${toolName} 需要用户确认，不能通过通用入口调用`,
                    code: 'CONFIRMATION_REQUIRED',
                },
                { status: 403 },
            );
        }

        const output = await executeTool(toolName, toolInput);

        // executeTool 的约定是「不抛异常，把错误放进返回值」。
        // 直接 200 返回会让前端把错误对象当结果渲染 —— 这正是
        // SiteWizard 之前把 404 页面当解释显示的同类问题。
        if (output && typeof output === 'object' && 'error' in (output as any)) {
            return NextResponse.json(
                { error: (output as any).error, toolName },
                { status: 502 },
            );
        }

        return NextResponse.json({ output, toolName });
    } catch (error) {
        console.error('AI tool execution error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '工具执行失败' },
            { status: 500 },
        );
    }
}
