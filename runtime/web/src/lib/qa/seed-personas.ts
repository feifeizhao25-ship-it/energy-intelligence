import type { ComposeInput } from '@/lib/dashboard/composer';

/** 五个种子用户。首页模块由规则表决定，不调用模型。 */
export const SEED_PERSONAS: ComposeInput[] = [
    { userId: 'seed-ci', role: 'ci_owner', day: 1, plan: '标准' },
    { userId: 'seed-dev', role: 'developer', day: 2, plan: '专业' },
    { userId: 'seed-res', role: 'researcher', day: 4, plan: '免费' },
    { userId: 'seed-gov', role: 'government', day: 7, plan: '团队' },
    { userId: 'seed-om', role: 'om', day: 3, plan: '标准' },
];
