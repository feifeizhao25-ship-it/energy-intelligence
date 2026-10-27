import rules from './rules/home-stages.json';

export interface HomeModule {
    id: string;
    reason: string;
}

export interface ComposeInput {
    userId: string;
    role: string;
    day: number;
    plan: string;
}

export function composeHome(input: ComposeInput): HomeModule[] {
    const stage = input.day <= 1 ? 'D1' : input.day <= 3 ? 'D2' : input.day < 7 ? 'D4' : 'D7';
    const stageModules = (rules.stages as Record<string, string[]>)[stage];
    const roleModules = (rules.roles as Record<string, string[]>)[input.role] || rules.roles.default;
    const ids = [...stageModules, ...roleModules].filter((id, index, all) => all.indexOf(id) === index).slice(0, 8);
    return ids.map((id) => ({
        id,
        reason: `${(rules.reasons as Record<string, string>)[id] || '与当前阶段对应'}（${input.role}，第 ${input.day} 天，${input.plan}）`,
    }));
}
