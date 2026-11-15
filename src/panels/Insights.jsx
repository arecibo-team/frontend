import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { MONTHS_SHORT, num } from "../lib/format.js";
import { POWER_COLORS, POWER_STEPS, classColor } from "../lib/geo.js";
import { useFetch } from "../lib/useFetch.js";

export const CONTEXT_FROM = "2024-01";
export const CONTEXT_TO = "2026-10";
export const REGION_LABEL = { north: "North", east: "East", south: "South", west: "West" };

export const contextMonth = date => {
  const m = date.slice(0, 7);
  return m >= CONTEXT_FROM && m <= CONTEXT_TO ? m : null;
};
const monthLabel = m => `${MONTHS_SHORT[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

function Skeleton({ h = 72 }) {
  return <div className="skeleton" style={{ height: h }} />;
}

function Card({ title, aside, children }) {
  return (
    <section className="card">
      <header className="card-head">
        <h3 className="h3">{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Diverging({ label, z, invert = false, hint }) {
  if (z == null) {
    return (
      <div className="div-row">
        <span>{label}</span>
        <span className="div-track muted" />
        <span className="div-val small">–</span>
      </div>
    );
  }
  const v = Math.max(-3, Math.min(3, z));
  const dry = invert ? v < 0 : v > 0;
  const width = (Math.abs(v) / 3) * 50;
  return (
    <div className="div-row" title={hint}>
      <span>{label}</span>
      <span className="div-track">
        <i className="div-mid" />
        <b className={dry ? "dry" : "wet"} style={v >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }} />
      </span>
      <span className="div-val mono">{z > 0 ? "+" : ""}{z.toFixed(1)}</span>
    </div>
  );
}

function Sparkline({ values, highlight, height = 44, color = "var(--ink)", zero = false, format = v => v }) {
  const pts = values.filter(v => v.y != null);
  if (pts.length < 2) return null;
  const ys = pts.map(p => p.y);
  const lo = Math.min(...ys, zero ? 0 : Infinity);
  const hi = Math.max(...ys, zero ? 0 : -Infinity);
  const W = 100;
  const x = i => (i / (values.length - 1)) * W;
  const y = v => height - 4 - ((v - lo) / Math.max(hi - lo, 1e-6)) * (height - 8);
  const d = values.map((p, i) => (p.y == null ? null : `${x(i)},${y(p.y)}`)).filter(Boolean).join(" ");
  const hi_i = values.findIndex(p => p.x === highlight);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ height }} role="img" aria-label="Trend">
      {zero && lo < 0 && hi > 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="spark-zero" />}
      <polyline points={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {hi_i >= 0 && values[hi_i].y != null && (
        <circle cx={x(hi_i)} cy={y(values[hi_i].y)} r="2.6" fill="var(--fire)" vectorEffect="non-scaling-stroke">
          <title>{`${values[hi_i].x}: ${format(values[hi_i].y)}`}</title>
        </circle>
      )}
    </svg>
  );
}

const REGION_STEPS = [20, 35, 50, 65];
const REGION_COLORS = ["#c2410c", "#f2a46b", "#ebe6dc", "#8faed4", "#244f80"];

export function RegionsCompass({ iso2, rows, power, focusRegion, loading }) {
  if (loading && !rows) return <Card title="Firefighters by region"><Skeleton h={180} /></Card>;
  const mine = (rows || []).filter(r => r.iso2 === iso2);
  if (!mine.length || !mine[0].available) {
    return (
      <Card title="Firefighters by region">
        <p className="small">No regional estimate for this country.</p>
      </Card>
    );
  }
  const by = Object.fromEntries(mine.map(r => [r.region, r]));
  const stressed = mine.filter(r => r.load_ratio != null && r.load_ratio >= 1.5).sort((a, b) => b.load_ratio - a.load_ratio)[0];
  const cell = region => {
    const r = by[region];
    return (
      <div className={`compass-cell c-${region}${region === focusRegion ? " focus" : ""}${r.load_ratio >= 1.5 ? " hot" : ""}`}>
        <div className="compass-top">
          <span className="compass-name">{REGION_LABEL[region]}</span>
          <span className="compass-power" style={{ background: classColor(r.power, REGION_STEPS, REGION_COLORS), color: r.power < 20 || r.power >= 65 ? "#fff" : "var(--ink)" }}>
            {Math.round(r.power)}
          </span>
        </div>
        <div className="compass-ff mono">{num(r.firefighters)}</div>
        <div className="compass-meta">
          {r.active_fires ? `${r.active_fires} ${r.active_fires === 1 ? "fire" : "fires"}` : "No active fire"}
          {r.fire_share != null && ` · ${Math.round(r.fire_share * 100)}% of fire`}
        </div>
      </div>
    );
  };
  return (
    <Card title="Firefighters by region" aside={<span className="small">power in each region</span>}>
      <div className="compass">
        {cell("north")}
        {cell("west")}
        <div className="compass-core">
          <span className="small">Country</span>
          <b className="mono">{Math.round(power)}</b>
        </div>
        {cell("east")}
        {cell("south")}
      </div>
      {stressed && (
        <p className="callout-line">
          {REGION_LABEL[stressed.region]} {stressed.name} has {Math.round(stressed.share * 100)}% of the firefighters but {Math.round(stressed.fire_share * 100)}% of this month's fire
          {stressed.largest_fire ? `, including ${stressed.largest_fire}` : ""}
        </p>
      )}
    </Card>
  );
}

export function ReasonsCard({ iso2 }) {
  const { data, loading } = useFetch(() => api.scoreDetail(iso2), [iso2]);
  if (loading && !data) return <Card title="Why this score"><Skeleton h={96} /></Card>;
  if (!data) return null;
  const max = Math.max(...data.reasons.map(r => Math.abs(r.points)), 1);
  return (
    <Card title="Why this score" aside={<span className="chip-static">{data.archetype}</span>}>
      <p className="small" style={{ margin: "0 0 10px" }}>
        Amber index {Math.round(data.amber)} in {data.year}, rank {data.rank} of 27 (likely between {data.rank_lo} and {data.rank_hi})
      </p>
      <div className="reasons">
        {data.reasons.map(r => (
          <div key={r.feature} className="reason">
            <span className="reason-text">{r.text}</span>
            <span className="reason-bar">
              <b className={r.points > 0 ? "up" : "down"} style={{ width: `${(Math.abs(r.points) / max) * 100}%` }} />
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function TrendCard({ iso2 }) {
  const { data, loading } = useFetch(() => api.scoreHistory(iso2), [iso2]);
  if (loading && !data) return <Card title="Over the years"><Skeleton h={90} /></Card>;
  if (!data?.length) return null;
  const last = data[data.length - 1];
  const first = data[0];
  return (
    <Card title="Over the years" aside={<span className="small">{first.year}–{last.year}</span>}>
      <div className="trend">
        <div>
          <div className="label">Amber index</div>
          <Sparkline values={data.map(r => ({ x: r.year, y: r.amber }))} highlight={last.year} color="var(--fire)" />
          <div className="trend-ends mono"><span>{Math.round(first.amber)}</span><span>{Math.round(last.amber)}</span></div>
        </div>
        <div>
          <div className="label">Power</div>
          <Sparkline values={data.map(r => ({ x: r.year, y: r.power }))} highlight={last.year} color="#244f80" />
          <div className="trend-ends mono"><span>{Math.round(first.power)}</span><span>{Math.round(last.power)}</span></div>
        </div>
      </div>
    </Card>
  );
}

export function ContextCard({ iso2, box, date }) {
  const month = contextMonth(date);
  const center = box ? [((box[1] + box[3]) / 2).toFixed(3), ((box[0] + box[2]) / 2).toFixed(3)] : null;
  const country = useFetch(() => (iso2 ? api.context.country(iso2, month || undefined) : Promise.resolve(null)), [iso2, month]);
  const point = useFetch(() => (center ? api.context.point(center[0], center[1], month || date.slice(0, 7)) : Promise.resolve(null)), [center?.join(","), month, date.slice(0, 7)]);
  const c = country.data;
  const p = point.data;
  if ((country.loading && !c) || (point.loading && !p)) return <Card title="Fuel and dryness"><Skeleton h={150} /></Card>;
  if (!c && !p) return null;
  const fuel = c ? c.fuel.wildland_fuel_pct : p?.land?.wildland_fuel_pct;
  const steep = c ? c.terrain.steep_pct : p?.terrain?.steep_pct;
  const moist = month ? c?.moisture : null;
  const shownMonth = month ? (c ? c.month : p?.month) : null;
  const dz = month ? (c ? c.dryness_z : p?.dryness_z) : null;
  const label = c ? c.dryness : p?.dryness;
  return (
    <Card
      title="Fuel and dryness"
      aside={<span className="small">{shownMonth ? monthLabel(shownMonth) : "land and terrain"}</span>}
    >
      <div className="fuel-grid">
        <div>
          <div className="label">Wildland fuel</div>
          <div className="big mono">{fuel != null ? `${Math.round(fuel)}%` : "–"}</div>
          <div className="meter"><b style={{ width: `${Math.min(100, fuel || 0)}%` }} /></div>
          <div className="small">forest, shrub and grass</div>
        </div>
        <div>
          <div className="label">Steep land</div>
          <div className="big mono">{steep != null ? `${Math.round(steep)}%` : "–"}</div>
          <div className="meter"><b style={{ width: `${Math.min(100, (steep || 0) * 2)}%` }} /></div>
          <div className="small">slopes over 20°</div>
        </div>
      </div>
      {dz != null && (
        <div className={`dryness-pill ${dz >= 0.5 ? "dry" : dz <= -0.5 ? "wet" : ""}`}>
          {label}
          {c?.fuel_risk != null && <span className="mono">fuel risk {Math.round(c.fuel_risk)}</span>}
        </div>
      )}
      {moist && (
        <div className="divergings">
          <Diverging label="Topsoil moisture" z={moist.soil_moisture_z} invert hint="Below 0 is drier than 2001–2020" />
          <Diverging label="Root-zone moisture" z={moist.deep_soil_moisture_z} invert />
          <Diverging label="Land heat" z={moist.lst_z} hint="Above 0 is hotter than 2001–2020" />
          <Diverging label="Greenness" z={moist.ndvi_z} invert />
        </div>
      )}
      {p && !c && p.soil && (
        <div className="divergings">
          <Diverging label="Topsoil moisture" z={p.soil.z} invert />
          <Diverging label="Land heat" z={p.vegetation?.lst_z ?? null} />
          <Diverging label="Greenness" z={p.vegetation?.ndvi_z ?? null} invert />
        </div>
      )}
      {month && c?.series && (
        <div className="dry-series">
          <div className="label">Dryness, Jan 2024 to Oct 2026</div>
          <Sparkline values={c.series.map(s => ({ x: s.month, y: s.dryness_z }))} highlight={shownMonth} color="#b45309" zero format={v => v.toFixed(1)} />
        </div>
      )}
      {!month && <p className="small" style={{ marginTop: 12 }}>Soil moisture, greenness and heat anomalies cover Jan 2024 to Oct 2026. Pick a day in that period to see them.</p>}
    </Card>
  );
}

const WEATHER_ROWS = [
  ["temperature", "Air temperature", v => `${v.toFixed(1)} °C`],
  ["air_relative_humidity", "Humidity", v => `${Math.round(v)}%`],
  ["wind_speed", "Wind", v => `${(v * 3.6).toFixed(0)} km/h`],
  ["precipitation", "Rain", v => `${v.toFixed(1)} mm/h`],
  ["surface_soil_wetness", "Topsoil wetness", v => `${Math.round(v * 100)}%`],
  ["vapor_pressure_deficit", "Vapour pressure deficit", v => `${v.toFixed(2)} kPa`]
];

export function FireDetail({ fire }) {
  const time = `${fire.last_date}T${fire.last_time}:00Z`;
  const weather = useFetch(() => api.firms.weather(fire.lat, fire.lon, time), [fire.id]);
  const point = useFetch(() => api.context.point(fire.lat, fire.lon, fire.last_date.slice(0, 7)), [fire.id]);
  const f = weather.data?.features || {};
  const land = point.data?.land;
  const terrain = point.data?.terrain;
  const dir = f.wind_direction?.value;
  return (
    <div className="fire-detail">
      <div className="fd-head">
        <div>
          <b>{fire.name}</b>
          <span className="small">{fire.country}, day {fire.day}, {num(fire.detections)} hotspots</span>
        </div>
        <span className="fd-ratio">{fire.ratio.toFixed(1)}×</span>
      </div>
      <h4 className="fd-label">Fire weather at the last pass, {fire.last_time} UTC</h4>
      {weather.loading && !weather.data && <Skeleton h={64} />}
      {weather.error && <p className="small">Weather unavailable</p>}
      {weather.data && (
        <div className="wx">
          {WEATHER_ROWS.filter(([k]) => f[k]?.value != null).map(([k, label, fmt]) => (
            <div key={k}>
              <span>{label}</span>
              <b className="mono">
                {fmt(f[k].value)}
                {k === "wind_speed" && dir != null && <i className="wind-arrow" style={{ transform: `rotate(${dir + 180}deg)` }} title={`from ${Math.round(dir)}°`}>↑</i>}
              </b>
            </div>
          ))}
        </div>
      )}
      {(land || terrain) && (
        <>
          <h4 className="fd-label">Ground around it</h4>
          <div className="wx">
            {land && <div><span>Wildland fuel</span><b className="mono">{Math.round(land.wildland_fuel_pct)}%</b></div>}
            {land && <div><span>Forest</span><b className="mono">{Math.round(land.forest_pct)}%</b></div>}
            {terrain && <div><span>Elevation</span><b className="mono">{num(terrain.elev_m)} m</b></div>}
            {terrain && <div><span>Mean slope</span><b className="mono">{terrain.slope_deg.toFixed(0)}°</b></div>}
          </div>
        </>
      )}
      <p className="small fd-src">{weather.data?.data_kind === "historical_reanalysis" ? "NASA POWER reanalysis" : "DWD ICON"} · CORINE · Copernicus DEM</p>
    </div>
  );
}

const PILLARS = [
  ["danger", "Fire danger"],
  ["hazards", "Other hazards"],
  ["workforce", "Workforce"],
  ["capability", "Capability"]
];

const MODEL_W = { danger: 1.41, hazards: 0.91, workforce: 0.64, capability: 1.04 };

export function WeightsPanel({ iso2 }) {
  const [w, setW] = useState(MODEL_W);
  const [debounced, setDebounced] = useState(w);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(w), 250);
    return () => clearTimeout(t);
  }, [w]);
  const base = useFetch(() => api.customWeights(MODEL_W), []);
  const custom = useFetch(() => api.customWeights(debounced), [JSON.stringify(debounced)]);
  const baseRank = useMemo(() => Object.fromEntries((base.data?.scores || []).map(s => [s.iso2, s.rank])), [base.data]);
  const rows = custom.data?.scores || [];
  const total = PILLARS.reduce((t, [k]) => t + w[k], 0) || 1;
  return (
    <div className="weights">
      <div className="weights-controls">
        <p className="small">How much each pillar counts in the Amber index. The ranking updates as you move them.</p>
        {PILLARS.map(([k, label]) => (
          <label key={k} className="slider-row">
            <span>{label}</span>
            <input type="range" min="0" max="2" step="0.1" value={w[k]} onChange={e => setW({ ...w, [k]: Number(e.target.value) })} />
            <b className="mono">{Math.round((w[k] / total) * 100)}%</b>
          </label>
        ))}
        <button className="text-btn" type="button" onClick={() => setW(MODEL_W)}>Reset to the model's weights</button>
      </div>
      <ol className={`weights-list${custom.loading ? " busy" : ""}`}>
        {rows.map(s => {
          const delta = baseRank[s.iso2] ? baseRank[s.iso2] - s.rank : 0;
          return (
            <li key={s.iso2} className={s.iso2 === iso2 ? "me" : ""}>
              <span className="mono n">{s.rank}</span>
              <span>{s.name}</span>
              <span className={`delta-chip ${delta > 0 ? "up" : delta < 0 ? "down" : ""}`}>{delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : "="}</span>
              <span className="mono score">{Math.round(s.amber)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
