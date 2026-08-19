 initialValues={{ capacity_mw: 200, capex_per_w: 1.35, opex_per_kw_yr: 42, electricity_price: 0.065, wind_speed: 7.0, capacity_factor: 0.30, lifetime: 20 }}>
 <Form.Item name="capex_per_w" label="Capital Cost (USD/W)"><InputNumber min={0.5} max={5} step={0.05} style={{ width: '100%' }} /></Form.Item>
 <Form.Item name="opex_per_kw_yr" label="Annual O&amp;M (USD/kW-year)"><InputNumber min={5} max={200} style={{ width: '100%' }} /></Form.Item>
 <Form.Item name="electricity_price" label="Electricity Price (USD/kWh)"><InputNumber min={0.01} max={0.5} step={0.005} style={{ width: '100%' }} /></Form.Item>
 {result.lcoe !== undefined && <Col xs={12}><Statistic title="LCOE" value={result.lcoe} suffix="USD/kWh" precision={3} valueStyle={{ color: '#0A2E6B' }} /></Col>}
 {result.npv !== undefined && <Col xs={12}><Statistic title="NPV" value={result.npv.toLocaleString()} suffix="USD" /></Col>}