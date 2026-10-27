import { productionForbidsSimulation, reconcilePayments } from './reconcile';

it('账单和订单不一致时告警', () => {
  const same = reconcilePayments(
    [{ orderNo: 'A', amount: 10, status: 'completed' }],
    [{ orderNo: 'A', amount: 10, status: 'success' }],
  );
  expect(same.alert).toBe(false);
  expect(same.diff).toBe(0);
  const drifted = reconcilePayments(
    [{ orderNo: 'A', amount: 10, status: 'completed' }],
    [{ orderNo: 'A', amount: 9.5, status: 'success' }, { orderNo: 'B', amount: 1, status: 'success' }],
  );
  expect(drifted.alert).toBe(true);
  expect(drifted.amountMismatch).toEqual(['A']);
  expect(drifted.missingInLedger).toEqual(['B']);
});

it('生产环境拒绝沙箱和模拟开关', () => {
  expect(() => productionForbidsSimulation('production', true, '0')).toThrow(/禁止模拟支付/);
  expect(() => productionForbidsSimulation('production', false, '1')).toThrow(/禁止模拟支付/);
  expect(() => productionForbidsSimulation('development', true, '1')).not.toThrow();
});
