import { USAGE_LIMITS } from '@/lib/membership/plans';

/** 新手引导最后一页展示的免费档额度，必须与会员权益表一致，不能再写死旧数字。 */
export const onboardingFreeQuotas = [
    { label: '每日 AI 对话', value: USAGE_LIMITS.FREE.ai_chat },
    { label: '每日项目测算', value: USAGE_LIMITS.FREE.calculation },
    { label: '最多项目数', value: USAGE_LIMITS.FREE.projects },
] as const;
