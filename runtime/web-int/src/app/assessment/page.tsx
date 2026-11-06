'use client';
import { useState } from 'react';
import { solarScreening } from '../../lib/solar-kernel';
import sources from '../../lib/screening-sources.json';

export default function Assessment() {
  const [capacity, setCapacity] = useState('1000');
  const [resource, setResource] = useState('1500');
  const [latitude, setLatitude] = useState('39.9');
  const [sourceId, setSourceId] = useState('');
  const selected = sources.find((item) => item.id === sourceId) ?? null;
  const numbersReady = capacity.trim() !== '' && resource.trim() !== '' && latitude.trim() !== ''
    && Number.isFinite(Number(capacity)) && Number(capacity) > 0
    && Number.isFinite(Number(resource)) && Number(resource) > 0
    && Number.isFinite(Number(latitude)) && Math.abs(Number(latitude)) <= 90;
  const calculated = selected && numbersReady
    ? solarScreening({ capacityKw: Number(capacity), annualGhiKwhPerM2: Number(resource), latitude: Number(latitude) })
    : null;
  const result = calculated && Object.values(calculated).every(value => typeof value !== 'number' || Number.isFinite(value)) ? calculated : null;
  return <main className="shell">
    <div className="eyebrow">Screening assessment</div>
    <h1>Test the assumptions before you calculate.</h1>
    <section aria-label="Resource data sources">
      <h2>Resource data sources</h2>
      <p>PVGIS, NSRDB, and NASA POWER stay in separate cards. Enter the annual GHI from one of them. This page does not average the three into a single irradiance number.</p>
      <div className="grid" data-testid="screening-sources">
        {sources.map((item) => (
          <article key={item.id} className="card" data-source-id={item.id}>
            <h3>{item.name}</h3>
            <p>{item.publisher}</p>
            <p>{item.region}</p>
            <p>{item.note}</p>
            <p><a href={item.url}>{item.url}</a></p>
          </article>
        ))}
      </div>
    </section>
    <div className="grid two">
      <section className="card stack">
        <label>Technology<select value="solar" onChange={() => {}}>
          <option value="solar">Solar PV</option>
          <option value="wind" disabled>Onshore wind — not available yet</option>
          <option value="storage" disabled>Battery storage — not available yet</option>
        </select></label>
        <p>This assessment supports solar PV only. Wind and storage calculations are not available here.</p>
        <label>GHI source
          <select aria-label="GHI source" value={sourceId} onChange={e => setSourceId(e.target.value)}>
            <option value="">Select one source — do not combine them</option>
            {sources.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>Capacity (kW)<input type="number" min="0" step="any" value={capacity} onChange={e => setCapacity(e.target.value)} /></label>
        <label>Annual GHI from the selected source (kWh/m²)<input type="number" min="0" step="any" value={resource} onChange={e => setResource(e.target.value)} /></label>
        <label>Latitude (degrees)<input type="number" min="-90" max="90" step="any" value={latitude} onChange={e => setLatitude(e.target.value)} /></label>
        <p>GHI is the sunlight energy received on a horizontal surface for the one source you selected. The starting numbers are examples, not a measurement and not a blend of PVGIS, NSRDB, and NASA POWER.</p>
      </section>
      <section className="card" aria-live="polite" aria-label="Screening result">
        {!selected ? <p role="status">No generation figure yet. Choose PVGIS, NSRDB, or NASA POWER, then enter that source&apos;s annual GHI. The other two stay on the page and are not folded into the result.</p> : !result ? <p role="alert">Enter positive capacity and annual GHI, and a latitude between −90 and 90 degrees. Complete every field to see a valid result for {selected.name} only.</p> : <>
          <span className="badge">Solar PV screening estimate — {selected.name} only</span>
          <div className="metric">{result.annualGenerationKwh.toLocaleString('en-US')}</div>
          <p>kWh estimated first-year generation from the GHI you entered for {selected.name}. Plane-of-array irradiation {result.planeIrradiationKwhPerM2.toLocaleString('en-US')} kWh/m² at {result.tiltDeg}° tilt, performance ratio {result.performanceRatio}, specific yield {result.specificYieldKwhPerKw.toLocaleString('en-US')} kWh/kW.</p>
          <p>The other listed sources are not included in this number.</p>
          <p>This estimate uses your inputs and a calculation in this browser. It does not fetch current weather, tariffs or site measurements, and it does not save a project.</p>
          <p>Method: {result.method}. This is a factual calculation only — not investment advice, a return guarantee or a price prediction, and not a bankable yield report. Validate monthly resource data, loss assumptions, curtailment, degradation and local grid constraints before any decision.</p>
        </>}
      </section>
    </div>
  </main>;
}
