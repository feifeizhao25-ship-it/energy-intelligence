 const storageCapex = values.capacity_mw * 1000 * 320 * 4; // Four-hour storage system
 const annualRev = values.capacity_mw * 350 * 4 * 0.11 * 0.85;
 <Form layout="inline" onFinish={onCompare} initialValues={{ capacity_mw: 100, capex_per_w: 1.0, opex_per_kw_yr: 25, electricity_price: 0.06, lifetime: 25 }}>
 <Form.Item name="capex_per_w" label="Capital Cost (USD/W)"><InputNumber min={0.3} max={5} step={0.05} /></Form.Item>
 <Form.Item name="opex_per_kw_yr" label="Annual O&amp;M (USD/kW-year)"><InputNumber min={5} max={200} /></Form.Item>
 <Form.Item name="electricity_price" label="Electricity Price (USD/kWh)"><InputNumber min={0.01} max={0.5} step={0.005} /></Form.Item>
 { title: 'LCOE (USD/kWh)', dataIndex: 'lcoe', key: 'lcoe', render: (v: number) => v?.toFixed(3) || 'N/A' },
 { title: 'NPV (USD)', dataIndex: 'npv', key: 'npv', render: (v: number) => v?.toLocaleString() || 'N/A' },
 { title: 'Annual Revenue (USD)', dataIndex: 'annual_revenue', key: 'annual_revenue', render: (v: number) => v?.toLocaleString() || 'N/A' },
