'use client';
import { useState } from 'react';
import { solarScreening } from '../../lib/solar-kernel';

export default function Assessment() {
  const [capacity, setCapacity] = useState('1000');
  const [resource, setResource] = useState('1500');
  const [latitude, setLatitude] = useState('39.9');
  const valid = capacity.trim() !== '' && resource.trim() !== '' && latitude.trim() !== ''
    && Number.isFinite(Number(capacity)) && Number(capacity) > 0
    && Number.isFinite(Number(resource)) && Number(resource) > 0
    && Number.isFinite(Number(latitude)) && Math.abs(Number(latitude)) <= 90;
  const calculated = valid ? solarScreening({ capacityKw: Number(capacity), annualGhiKwhPerM2: Number(resource), latitude: Number(latitude) }) : null;
  const result = calculated && Object.values(calculated).every(value => typeof value !== 'number' || Number.isFinite(value)) ? calculated : null;
  return <main className="shell">
    <div className="eyebrow">Screening assessment</div>
    <h1>Test the assumptions before you calculate.</h1>
    <div className="grid two">
      <section className="card stack">
        <label>Technology<select value="solar" onChange={() => {}}>
          <option value="solar">Solar PV</option>
          <option value="wind" disabled>Onshore wind — not available yet</option>
          <option value="storage" disabled>Battery storage — not available yet</option>
        </select></label>
        <p>This assessment supports solar PV only. Wind and storage calculations are not available here.</p>
        <label>Capacity (kW)<input type="number" min="0" step="any" value={capacity} onChange={e => setCapacity(e.target.value)} /></label>
        <label>Annual GHI (kWh/m²)<input type="number" min="0" step="any" value={resource} onChange={e => setResource(e.target.value)} /></label>
        <label>Latitude (degrees)<input type="number" min="-90" max="90" step="any" value={latitude} onChange={e => setLatitude(e.target.value)} /></label>
        <p>GHI is the sunlight energy received on a horizontal surface. Enter a verified annual value for your location. The starting values are examples, not measurements for your site.</p>
      </section>
      <section className="card" aria-live="polite" aria-label="Screening result">
        {!result ? <p role="alert">Enter positive capacity and annual GHI, and a latitude between −90 and 90 degrees. Complete every field to see a valid result.</p> : <>
          <span className="badge">Solar PV screening estimate</span>
          <div className="metric">{result.annualGenerationKwh.toLocaleString('en-US')}</div>
          <p>kWh estimated first-year generation. Plane-of-array irradiation {result.planeIrradiationKwhPerM2.toLocaleString('en-US')} kWh/m² at {result.tiltDeg}° tilt, performance ratio {result.performanceRatio}, specific yield {result.specificYieldKwhPerKw.toLocaleString('en-US')} kWh/kW.</p>
          <p>This estimate uses your inputs and a calculation in this browser. It does not fetch current weather, tariffs or site measurements, and it does not save a project.</p>
          <p>Method: {result.method}. This is a factual calculation only — not investment advice, a return guarantee or a price prediction, and not a bankable yield report. Validate monthly resource data, loss assumptions, curtailment, degradation and local grid constraints before any decision.</p>
        </>}
      </section>
    </div>
  </main>;
}
