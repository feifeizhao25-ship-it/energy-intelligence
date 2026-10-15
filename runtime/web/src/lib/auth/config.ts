export { authOptions } from './auth-options';

type PlanLimit = {
  name: string;
  aiCalls: number;
  resourceQueries: number;
  calculations: number;
  paperSearches: number;
  diagnoses: number;
};

export const PLANS: Record<string, PlanLimit> = {
  FREE: { name: '免费版', aiCalls: 5, resourceQueries: 3, calculations: 3, paperSearches: 3, diagnoses: 0 },
  PRO: { name: '专业版', aiCalls: 100, resourceQueries: -1, calculations: -1, paperSearches: -1, diagnoses: 3 },
  MAINTENANCE: { name: '运维版（已停售）', aiCalls: 100, resourceQueries: -1, calculations: 10, paperSearches: 10, diagnoses: -1 },
  FULL: { name: '专家版', aiCalls: 300, resourceQueries: -1, calculations: -1, paperSearches: -1, diagnoses: -1 },
  TEAM: { name: '团队版', aiCalls: 1500, resourceQueries: -1, calculations: -1, paperSearches: -1, diagnoses: -1 },
  ENTERPRISE: { name: '企业版', aiCalls: -1, resourceQueries: -1, calculations: -1, paperSearches: -1, diagnoses: -1 },
};
