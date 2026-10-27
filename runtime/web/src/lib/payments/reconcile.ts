/** 平台账单与本地已支付订单对账。差额非零即告警，不把模拟流水当成成功。 */

export interface LedgerRow { orderNo: string; amount: number; status: string }
export interface BillRow { orderNo: string; amount: number; status: string }

export function reconcilePayments(ledger: LedgerRow[], bill: BillRow[]) {
  const paid = new Map(ledger.filter((row) => row.status === 'completed' || row.status === 'paid').map((row) => [row.orderNo, round(row.amount)]));
  const received = new Map(bill.filter((row) => row.status === 'success' || row.status === 'TRADE_SUCCESS').map((row) => [row.orderNo, round(row.amount)]));
  const missingInBill = [...paid.keys()].filter((orderNo) => !received.has(orderNo));
  const missingInLedger = [...received.keys()].filter((orderNo) => !paid.has(orderNo));
  const amountMismatch = [...paid.keys()].filter((orderNo) => received.has(orderNo) && received.get(orderNo) !== paid.get(orderNo));
  const ledgerSum = sum(paid);
  const billSum = sum(received);
  const diff = round(billSum - ledgerSum);
  const alert = diff !== 0 || missingInBill.length > 0 || missingInLedger.length > 0 || amountMismatch.length > 0;
  return { diff, ledgerSum, billSum, missingInBill, missingInLedger, amountMismatch, alert };
}

export function productionForbidsSimulation(environment: string, sandbox: boolean, simulationFlag: string | undefined) {
  if (environment === 'production' && (sandbox || simulationFlag === '1')) {
    throw new Error('生产环境禁止模拟支付');
  }
}

function sum(rows: Map<string, number>) {
  return round([...rows.values()].reduce((total, value) => total + value, 0));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
