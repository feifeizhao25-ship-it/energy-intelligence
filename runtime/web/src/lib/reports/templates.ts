/**
 * 🏰 护城河系统：交付物系统 - 报告模板
 * 通用AI很难产出高度标准化的交付件，这是我们的核心竞争力
 */

export interface ReportTemplate {
  id: string;
  name: string;
  category: string;
  sections: Array<{
    id: string;
    title: string;
    type: 'text' | 'table' | 'chart' | 'conclusion';
    content: string;
  }>;
}

export const REPORT_TEMPLATES: Record<string, ReportTemplate> = {
  'FEASIBILITY_SOLAR': {
    id: 'solar-feasibility',
    name: '分布式光伏项目可行性研究报告',
    category: '可研',
    sections: [
      { id: 'cover', title: '封面', type: 'text', content: '项目名称：{{project.name}}' },
      { id: 'summary', title: '执行摘要', type: 'conclusion', content: '本项目预计IRR为{{result.irr}}...' },
      { id: 'resource', title: '资源分析', type: 'text', content: '经度：{{resource.lat}}...' },
      { id: 'financial', title: '财务评价', type: 'table', content: '25年现金流表...' },
      { id: 'audit', title: '计算审计声明', type: 'text', content: '计算ID：{{snapshot.id}}，版本：{{snapshot.version}}' }
    ]
  }
};

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits }).format(value);
}

export function formatPercent(value: number, maximumFractionDigits = 2): string {
  return `${formatNumber(value, maximumFractionDigits)}%`;
}

export function formatCurrency(value: number, currency = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
