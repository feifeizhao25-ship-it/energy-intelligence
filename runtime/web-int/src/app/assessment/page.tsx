'use client';
import { useState } from 'react';
import { solarScreening } from '../../lib/solar-kernel';

export default function Assessment() {
  const [capacity, setCapacity] = useState(1000);
  const [resource, setResource] = useState(1500);
  const [latitude, setLatitude] = useState(39.9);
  const result = solarScreening({ capacityKw: capacity, annualGhiKwhPerM2: resource, latitude });
  return <main className="shell"><div className="eyebrow">Screening assessment</div><h1>Test the assumptions before the investment case.</h1><div className="grid two"><section className="card stack"><label>Technology<select><option>Solar PV</option><option>Onshore wind</option><option>Battery storage</option></select></label><label>Capacity (kW)<input type="number" min="1" value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></label><label>Annual GHI (kWh/m²)<input type="number" min="1" value={resource} onChange={e => setResource(Number(e.target.value))} /></label><label>Latitude (degrees)<input type="number" step="0.1" value={latitude} onChange={e => setLatitude(Number(e.target.value))} /></label></section><section className="card"><span className="badge">Screening result — shared CN/EN solar kernel</span><div className="metric">{result.annualGenerationKwh.toLocaleString('en-US')}</div><p>kWh estimated first-year generation. Plane-of-array irradiation {result.planeIrradiationKwhPerM2.toLocaleString('en-US')} kWh/m² at {result.tiltDeg}° tilt, performance ratio {result.performanceRatio}, specific yield {result.specificYieldKwhPerKw.toLocaleString('en-US')} kWh/kW.</p><p>Method: {result.method}. This is a factual calculation only — not investment advice, a return guarantee or a price prediction, and not a bankable yield report. Validate monthly resource data, loss assumptions, curtailment, degradation and local grid constraints before any decision.</p></section></div></main>;
}
