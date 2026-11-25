import registry from '@/lib/entitlements/entitlements.json';

export { authOptions } from './auth-options';

type PlanLimit = {
  name: string;
  aiCalls: number;
  resourceQueries: number;
  calculations: number;
  paperSearches: number;
  diagnoses: number;
};

type RegistryTier = {
  name: string;
  quotas: {
    ai_queries_per_day: number;
    resource_queries_per_day: number;
    calculations_per_day: number;
    diagnoses_per_day?: number;
  };
  knowledge: { paper_search_per_day: number };
};

function fromRegistry(id: string): PlanLimit {
  const tier = (registry.tiers as Record<string, RegistryTier>)[id];
  return {
    name: tier.name,
    aiCalls: tier.quotas.ai_queries_per_day,
    resourceQueries: tier.quotas.resource_queries_per_day,
    calculations: tier.quotas.calculations_per_day,
    paperSearches: tier.knowledge.paper_search_per_day,
    diagnoses: tier.quotas.diagnoses_per_day ?? 0,
  };
}

/** 会员状态接口用的名称和额度。只从权益注册表派生，不再手写第二套。 */
export const PLANS: Record<string, PlanLimit> = {
  FREE: fromRegistry('free'),
  PRO: fromRegistry('pro'),
  MAINTENANCE: fromRegistry('maintenance'),
  FULL: fromRegistry('full'),
  TEAM: fromRegistry('team'),
  ENTERPRISE: fromRegistry('enterprise'),
};
