import { savedCalculationRef } from './saved-calculations';

describe('工作台快照摘要', () => {
  it('用地址和容量做列表项，不带出电价或单位投资', () => {
    const row = savedCalculationRef({
      id: 'saved',
      calcType: 'SOLAR_REVENUE',
      projectId: null,
      createdAt: new Date('2026-11-12T00:00:00Z'),
      inputSnapshot: {
        location: { lat: 41.15, lng: 114.71, address: '河北张家口' },
        capacity: 100,
        unitCost: 3000,
        electricityPrice: 0.65123,
      },
    });
    expect(row).toMatchObject({ id: 'saved', name: '河北张家口', type: 'SOLAR', capacity: 100, projectId: null });
    expect(JSON.stringify(row)).not.toContain('0.65123');
    expect(JSON.stringify(row)).not.toContain('3000');
  });

  it('没有地名时用测算类型的中文名', () => {
    expect(savedCalculationRef({
      id: 'bare', calcType: 'SOLAR_REVENUE', projectId: null, createdAt: new Date(), inputSnapshot: { capacity: 1 },
    }).name).toBe('光伏初步估算');
  });
});
