// 项目生命周期编排器 - 规则引擎
// 执行规则并生成推荐动作

import type { Rule, RuleContext, RuleOutput, ActionCard, PaywallHint, ChecklistItem } from '../types';

/**
 * 规则引擎
 * 执行所有匹配的规则，合并输出
 */
export class RuleEngine {
    private rules: Rule[] = [];

    /**
     * 注册规则
     */
    register(rule: Rule | Rule[]): void {
        const rulesToAdd = Array.isArray(rule) ? rule : [rule];
        this.rules.push(...rulesToAdd);
        // 按优先级排序（数字越小优先级越高）
        this.rules.sort((a, b) => a.priority - b.priority);
    }

    /**
     * 执行所有规则
     */
    execute(ctx: RuleContext): {
        actions: ActionCard[];
        checklistUpdates: Partial<ChecklistItem>[];
        paywallHints: PaywallHint[];
        rulesFired: string[];
    } {
        const actions: ActionCard[] = [];
        const checklistUpdates: Partial<ChecklistItem>[] = [];
        const paywallHints: PaywallHint[] = [];
        const rulesFired: string[] = [];

        for (const rule of this.rules) {
            try {
                if (rule.when(ctx)) {
                    const output = rule.then(ctx);
                    rulesFired.push(rule.key);

                    if (output.actions) {
                        actions.push(...output.actions);
                    }
                    if (output.checklistUpdates) {
                        checklistUpdates.push(...output.checklistUpdates);
                    }
                    if (output.paywallHints) {
                        paywallHints.push(...output.paywallHints);
                    }
                }
            } catch (error) {
                console.error(`Rule ${rule.key} execution failed:`, error);
            }
        }

        // 去重（按 id）
        const uniqueActions = this.deduplicateActions(actions);
        const uniquePaywallHints = this.deduplicatePaywallHints(paywallHints);

        return {
            actions: uniqueActions,
            checklistUpdates,
            paywallHints: uniquePaywallHints,
            rulesFired,
        };
    }

    /**
     * 去重动作卡片
     */
    private deduplicateActions(actions: ActionCard[]): ActionCard[] {
        const seen = new Set<string>();
        return actions.filter(action => {
            if (seen.has(action.id)) return false;
            seen.add(action.id);
            return true;
        });
    }

    /**
     * 去重付费墙提示
     */
    private deduplicatePaywallHints(hints: PaywallHint[]): PaywallHint[] {
        const seen = new Set<string>();
        return hints.filter(hint => {
            if (seen.has(hint.featureKey)) return false;
            seen.add(hint.featureKey);
            return true;
        });
    }

    /**
     * 获取已注册规则数量
     */
    getRuleCount(): number {
        return this.rules.length;
    }
}

/**
 * 创建全局规则引擎实例
 */
export function createRuleEngine(): RuleEngine {
    return new RuleEngine();
}
