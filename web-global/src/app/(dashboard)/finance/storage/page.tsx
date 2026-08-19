 capacity_mwh: number;
 capex_per_kwh: number; // USD/kWh
 electricity_spread: number; // USD/kWh
 initialValues={{ capacity_mwh: 50, power_mw: 25, capex_per_kwh: 320, cycles_per_year: 350, round_trip_eff: 0.85, electricity_spread: 0.11, discount_rate: 0.06, lifetime: 15 }}>
 <Form.Item name="capex_per_kwh" label="Capital Cost (USD/kWh)"><InputNumber min={100} max={1500} step={10} style={{ width: '100%' }} /></Form.Item>
 <Form.Item name="electricity_spread" label="Electricity Price Spread (USD/kWh)"><InputNumber min={0.01} max={0.5} step={0.01} style={{ width: '100%' }} /></Form.Item>
 {result.lcoe !== undefined && <Col xs={12}><Statistic title="LCOE" value={result.lcoe} suffix="USD/kWh" precision={3} valueStyle={{ color: '#0A2E6B' }} /></Col>}
 {result.npv !== undefined && <Col xs={12}><Statistic title="NPV" value={result.npv.toLocaleString()} suffix="USD" /></Col>}
 {result.annual_revenue !== undefined && <Col xs={12}><Statistic title="Annual Revenue" value={result.annual_revenue.toLocaleString()} suffix="USD" /></Col>}
 {result.total_capex !== undefined && <Col xs={12}><Statistic title="Total Investment" value={result.total_capex.toLocaleString()} suffix="USD" /></Col>}