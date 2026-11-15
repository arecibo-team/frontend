import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { MONTHS_SHORT, num } from "../lib/format.js";
import { useFetch } from "../lib/useFetch.js";

export const CONTEXT_FROM = "2024-01";
export const CONTEXT_TO = "2026-10";
export const REGION_LABEL = { north: "North", east: "East", south: "South", west: "West" };
export const REGION_STEPS = [20, 35, 50, 65];
export const REGION_COLORS = ["#c2410c", "#f2a46b", "#ebe6dc", "#8faed4", "#244f80"];

export const contextMonth = date => {
  const m = date.slice(0, 7);
  return m >= CONTEXT_FROM && m <= CONTEXT_TO ? m : null;
};
const monthLabel = m => `${MONTHS_SHORT[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export function Section({ title, aside, children }) {
  return (
    <section className="sec">
      <header className="sec-head">
        <h3>{title}</h3>
        {aside && <span>{aside}</span>}
      </header>
      {children}
    </section>
  );
}

export function Pending({ rows = 3 }) {
  return (
    <div className="pending" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <i key={i} />)}
    </div>
  );
}

function Anomaly({ label, z, drierWhen = "low" }) {
  if (z == null) return null;
  const v = Math.max(-3, Math.min(3, z));
  const dry = drierWhen === "low" ? v < 0 : v > 0;
  const w = (Math.abs(v) / 3) * 50;
  return (
    <div className="anom">
      <dt>{label}</dt>
      <dd>
        <span className="anom-track">
          <b className={dry ? "dry" : "wet"} style={v >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
        </span>
        <span className="num">{z > 0 ? "+" : ""}{z.toFixed(1)}</span>
      </dd>
    </div>
  );
}

function Sparkline({ values, highlight, height = 36, tone = "ink", zero = false }) {
  const pts = values.filter(v => v.y != null);
  if (pts.length < 2) return null;
  const ys = pts.map(p => p.y);
  const lo = Math.min(...ys, zero ? 0 : Infinity);
  const hi = Math.max(...ys, zero ? 0 : -Infinity);
  const x = i => (i / (values.length - 1)) * 100;
  const y = v => height - 3 - ((v - lo) / Math.max(hi - lo, 1e-6)) * (height - 6);
  const d = values.map((p, i) => (p.y == null ? null : `${x(i)},${y(p.y)}`)).filter(Boolean).join(" ");
  const h = values.findIndex(p => p.x === highlight);
  return (
    <svg className={`spark spark-${tone}`} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      {zero && lo < 0 && hi > 0 && <line x1="0" x2="100" y1={y(0)} y2={y(0)} className="spark-zero" />}
      <polyline points={d} />
      {h >= 0 && values[h].y != null && <circle cx={x(h)} cy={y(values[h].y)} r="2.4" />}
    </svg>
  );
}

const shade = (value, steps, colors) => {
  let i = 0;
  while (i < steps.length && value >= steps[i]) i++;
  return colors[i];
};

export function RegionsTable({ iso2, rows, focusRegion, loading }) {
  if (loading && !rows) return <Section title="Firefighters by region"><Pending rows={4} /></Section>;
  const mine = (rows || []).filter(r => r.iso2 === iso2);
  if (!mine.length || !mine[0].available) {
    return (
      <Section title="Firefighters by region">
        <p className="quiet">No regional estimate</p>
      </Section>
    );
  }
  return (
    <Section title="Firefighters by region">
      <table className="tbl">
        <thead>
          <tr>
            <th />
            <th className="r">Firefighters</th>
            <th className="r">Fire</th>
            <th className="r">Power</th>
          </tr>
        </thead>
        <tbody>
          {["north", "east", "south", "west"].map(region => {
            const r = mine.find(x => x.region === region);
            const strained = r.load_ratio != null && r.load_ratio >= 1.5;
            return (
              <tr key={region} className={`${region === focusRegion ? "is-focus" : ""}${strained ? " is-strained" : ""}`}>
                <th scope="row">{REGION_LABEL[region]}</th>
                <td className="r num">{num(r.firefighters)}</td>
                <td className="r num">{r.fire_share != null ? `${Math.round(r.fire_share * 100)}%` : "–"}</td>
                <td className="r">
                  <span className="pw">
                    <i style={{ background: shade(r.power, REGION_STEPS, REGION_COLORS) }} />
                    <span className="num">{Math.round(r.power)}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

export function ReasonsList({ iso2 }) {
  const { data, loading } = useFetch(() => api.scoreDetail(iso2), [iso2]);
  if (loading && !data) return <Section title="Why this score"><Pending /></Section>;
  if (!data) return null;
  return (
    <Section title="Why this score" aside={data.archetype}>
      <ul className="reasons">
        {data.reasons.map(r => (
          <li key={r.feature}>
            <span>{r.text.replace(/ pushes the score (up|down) \d+ pts$/, "")}</span>
            <span className={`num ${r.points > 0 ? "up" : "down"}`}>{r.points > 0 ? "+" : "−"}{Math.abs(Math.round(r.points))}</span>
          </li>
        ))}
      </ul>
      <p className="quiet">Rank {data.rank_lo}–{data.rank_hi} of 27 in {data.year}</p>
    </Section>
  );
}

export function Trend({ iso2 }) {
  const { data, loading } = useFetch(() => api.scoreHistory(iso2), [iso2]);
  if (loading && !data) return <Section title="Since 2014"><Pending rows={2} /></Section>;
  if (!data?.length) return null;
  const last = data[data.length - 1];
  const series = [["Amber index", "amber", "ember"], ["Power", "power", "blue"]];
  return (
    <Section title={`${data[0].year}–${last.year}`}>
      <div className="trend">
        {series.map(([label, key, tone]) => (
          <div key={key}>
            <div className="trend-head">
              <span>{label}</span>
              <span className="num">{Math.round(data[0][key])} → {Math.round(last[key])}</span>
            </div>
            <Sparkline values={data.map(r => ({ x: r.year, y: r[key] }))} highlight={last.year} tone={tone} />
          </div>
        ))}
      </div>
    </Section>
  );
}

export function FuelDryness({ iso2, box, date }) {
  const month = contextMonth(date);
  const center = box ? [((box[1] + box[3]) / 2).toFixed(3), ((box[0] + box[2]) / 2).toFixed(3)] : null;
  const country = useFetch(() => (iso2 ? api.context.country(iso2, month || undefined) : Promise.resolve(null)), [iso2, month]);
  const point = useFetch(() => (center ? api.context.point(center[0], center[1], month || date.slice(0, 7)) : Promise.resolve(null)), [center?.join(","), month, date.slice(0, 7)]);
  const c = country.data;
  const p = point.data;
  if ((country.loading && !c) || (point.loading && !p)) return <Section title="Fuel and dryness"><Pending rows={4} /></Section>;
  if (!c && !p) return null;
  const fuel = c ? c.fuel.wildland_fuel_pct : p?.land?.wildland_fuel_pct;
  const steep = c ? c.terrain.steep_pct : p?.terrain?.steep_pct;
  const m = month ? (c ? c.moisture : null) : null;
  const pz = month && !c ? p : null;
  const dz = month ? (c ? c.dryness_z : p?.dryness_z) : null;
  const label = c ? c.dryness : p?.dryness;
  return (
    <Section title="Fuel and dryness" aside={month ? monthLabel(month) : null}>
      <dl className="defs">
        <div>
          <dt>Wildland fuel</dt>
          <dd><span className="num">{fuel != null ? `${Math.round(fuel)}%` : "–"}</span><span className="minibar"><b style={{ width: `${Math.min(100, fuel || 0)}%` }} /></span></dd>
        </div>
        <div>
          <dt>Land over 20° slope</dt>
          <dd><span className="num">{steep != null ? `${Math.round(steep)}%` : "–"}</span><span className="minibar"><b style={{ width: `${Math.min(100, steep || 0)}%` }} /></span></dd>
        </div>
        <div>
          <dt>Dryness</dt>
          <dd className={dz >= 0.5 ? "is-dry" : dz <= -0.5 ? "is-wet" : ""}>{month ? label : "Data starts Jan 2024"}</dd>
        </div>
      </dl>
      {m && (
        <dl className="defs anoms">
          <Anomaly label="Topsoil moisture" z={m.soil_moisture_z} />
          <Anomaly label="Root-zone moisture" z={m.deep_soil_moisture_z} />
          <Anomaly label="Land heat" z={m.lst_z} drierWhen="high" />
          <Anomaly label="Greenness" z={m.ndvi_z} />
        </dl>
      )}
      {pz?.soil && (
        <dl className="defs anoms">
          <Anomaly label="Topsoil moisture" z={pz.soil.z} />
          <Anomaly label="Land heat" z={pz.vegetation?.lst_z ?? null} drierWhen="high" />
          <Anomaly label="Greenness" z={pz.vegetation?.ndvi_z ?? null} />
        </dl>
      )}
      {month && c?.series && (
        <Sparkline values={c.series.map(s => ({ x: s.month, y: s.dryness_z }))} highlight={month} tone="ember" zero height={32} />
      )}
    </Section>
  );
}

const WEATHER = [
  ["temperature", "Air", v => `${v.toFixed(0)} °C`],
  ["air_relative_humidity", "Humidity", v => `${Math.round(v)}%`],
  ["wind_speed", "Wind", v => `${(v * 3.6).toFixed(0)} km/h`],
  ["vapor_pressure_deficit", "Vapour deficit", v => `${v.toFixed(2)} kPa`],
  ["surface_soil_wetness", "Topsoil wetness", v => `${Math.round(v * 100)}%`],
  ["precipitation", "Rain", v => `${v.toFixed(1)} mm/h`]
];
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function FireDetail({ fire }) {
  const time = `${fire.last_date}T${fire.last_time}:00Z`;
  const weather = useFetch(() => api.firms.weather(fire.lat, fire.lon, time), [fire.id]);
  const point = useFetch(() => api.context.point(fire.lat, fire.lon, fire.last_date.slice(0, 7)), [fire.id]);
  const f = weather.data?.features || {};
  const land = point.data?.land;
  const terrain = point.data?.terrain;
  const dir = f.wind_direction?.value;
  return (
    <dl className="defs fire-defs">
      {weather.loading && !weather.data && <Pending rows={3} />}
      {weather.error && <div><dt>Weather</dt><dd className="quiet">Unavailable</dd></div>}
      {WEATHER.filter(([k]) => f[k]?.value != null).map(([k, label, fmt]) => (
        <div key={k}>
          <dt>{label}</dt>
          <dd className="num">{fmt(f[k].value)}{k === "wind_speed" && dir != null ? ` ${COMPASS[Math.round(dir / 45) % 8]}` : ""}</dd>
        </div>
      ))}
      {land && <div><dt>Wildland fuel</dt><dd className="num">{Math.round(land.wildland_fuel_pct)}%</dd></div>}
      {terrain && <div><dt>Elevation, slope</dt><dd className="num">{num(terrain.elev_m)} m, {terrain.slope_deg.toFixed(0)}°</dd></div>}
    </dl>
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
  const changed = PILLARS.some(([k]) => w[k] !== MODEL_W[k]);
  return (
    <div className="weights">
      <div className="weights-controls">
        {PILLARS.map(([k, label]) => (
          <label key={k} className="slider-row">
            <span>{label}</span>
            <input type="range" min="0" max="2" step="0.05" value={w[k]} onChange={e => setW({ ...w, [k]: Number(e.target.value) })} />
            <span className="num">{Math.round((w[k] / total) * 100)}%</span>
          </label>
        ))}
        <button className="text-btn" type="button" onClick={() => setW(MODEL_W)} disabled={!changed}>Reset</button>
      </div>
      <table className={`tbl weights-tbl${custom.loading ? " busy" : ""}`}>
        <tbody>
          {rows.map(s => {
            const delta = baseRank[s.iso2] ? baseRank[s.iso2] - s.rank : 0;
            return (
              <tr key={s.iso2} className={s.iso2 === iso2 ? "is-focus" : ""}>
                <td className="num quiet">{s.rank}</td>
                <th scope="row">{s.name}</th>
                <td className={`r num delta ${delta > 0 ? "up" : delta < 0 ? "down" : ""}`}>{delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : ""}</td>
                <td className="r num">{Math.round(s.amber)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
