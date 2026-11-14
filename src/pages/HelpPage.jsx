import { useMemo, useState } from "react";
import { geoArea, geoCentroid } from "d3-geo";
import EuropeMap from "../components/EuropeMap.jsx";
import { api } from "../lib/api.js";
import { COUNTRIES, COUNTRY_NAMES, POWER_COLORS, POWER_STEPS, classColor } from "../lib/geo.js";
import { dayMonth, hours, listJoin, longDate, possessive, word } from "../lib/format.js";
import { useFetch } from "../lib/useFetch.js";

const SCENARIOS = [
  ["wildfire_season", "Wildfire season"],
  ["several_hazards", "Several hazards at once"],
  ["major_flood", "Major flood"],
  ["earthquake", "Earthquake"],
  ["drought", "Drought"]
];

const REASONS = {
  "already below": "are already below 50",
  "would drop below": "would drop below 50",
  "active fires": "have active fires",
  "low power": "have little to spare"
};
const REASONS_ONE = {
  "already below": "is already below 50",
  "would drop below": "would drop below 50",
  "active fires": "has active fires",
  "low power": "has little to spare"
};

function mainland(feature) {
  if (feature.geometry.type !== "MultiPolygon") return geoCentroid(feature);
  const parts = feature.geometry.coordinates.map(coordinates => ({ type: "Polygon", coordinates }));
  parts.sort((a, b) => geoArea(b) - geoArea(a));
  return geoCentroid(parts[0]);
}

const CENTROIDS = Object.fromEntries(
  COUNTRIES.filter(f => f.iso2).map(f => {
    const [lon, lat] = mainland(f);
    return [f.iso2, [lat, lon]];
  })
);

function Scenario({ form, setForm, onRun, busy }) {
  const names = Object.entries(COUNTRY_NAMES).sort((a, b) => a[1].localeCompare(b[1]));
  const set = patch => setForm({ ...form, ...patch });
  return (
    <aside className="panel panel-left" style={{ paddingTop: 24 }}>
      <div className="form-block">
        <h2 className="h2" style={{ marginBottom: 18 }}>Scenario</h2>
        <label className="label" htmlFor="recipient">Country that needs help</label>
        <select id="recipient" className="select" style={{ marginTop: 8 }} value={form.recipient} onChange={e => set({ recipient: e.target.value })}>
          {names.map(([iso2, name]) => (
            <option key={iso2} value={iso2}>{name}</option>
          ))}
        </select>
      </div>
      <fieldset className="form-block" style={{ border: 0, margin: "26px 0 0" }}>
        <legend className="label" style={{ padding: 0 }}>What it is facing</legend>
        <div className="radios">
          {SCENARIOS.map(([id, label]) => (
            <label key={id} className="radio">
              <input type="radio" name="scenario" checked={form.scenario === id} onChange={() => set({ scenario: id })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="form-block" style={{ border: 0, margin: "26px 0 0" }}>
        <legend className="label" style={{ padding: 0 }}>Rules for sending help</legend>
        <div className="checks">
          <label className="check">
            <input type="checkbox" checked={form.floor} onChange={e => set({ floor: e.target.checked })} />
            No donor drops below 50
          </label>
          <label className="check">
            <input type="checkbox" checked={form.skip} onChange={e => set({ skip: e.target.checked })} />
            Skip countries with active fires
          </label>
          <label className="check">
            <input type="checkbox" checked={form.fastest} onChange={e => set({ fastest: e.target.checked })} />
            Fastest arrival first
          </label>
        </div>
      </fieldset>
      <div className="form-block" style={{ marginTop: "auto", paddingTop: 28, paddingBottom: 20 }}>
        <button className="btn-dark" type="button" onClick={onRun} disabled={busy}>
          {busy ? "Planning…" : "Run the plan"}
        </button>
      </div>
    </aside>
  );
}

function leftOutSentence(items) {
  if (!items.length) return null;
  const groups = {};
  items.forEach(i => (groups[i.reason] = [...(groups[i.reason] || []), i.name]));
  const parts = Object.entries(groups).map(([reason, names]) => `${listJoin(names)} ${(names.length > 1 ? REASONS : REASONS_ONE)[reason] || reason}`);
  return `Left out: ${parts.join("; ")}.`;
}

function Side({ plan }) {
  const r = plan.recipient;
  const bars = [
    [`Before, ${dayMonth(plan.reference_date)}`, r.power_before, "#a8acb3"],
    ["After the fires", r.power_after, "#d9480f"],
    ["With help", r.power_with_help, "#18181b"]
  ];
  return (
    <aside className="panel panel-right">
      <div className="block">
        <h3 className="h3">{possessive(r.name)} power</h3>
        <div className="power-bars">
          {bars.map(([label, v, c]) => (
            <Bar key={label} label={label} value={v} color={c} />
          ))}
        </div>
      </div>
      <div className="block">
        <h3 className="h3">In order of arrival</h3>
        {plan.donors.length ? (
          <ol className="arrivals">
            {plan.donors.map((d, i) => (
              <li key={d.iso2}>
                <span className="n">{i + 1}</span>
                <span className="who">{d.name}</span>
                <span className="eta">{hours(d.eta_h)}</span>
                <span className="what">{d.resources}</span>
                <span className="pw">
                  {Math.round(d.power_before)} to {Math.round(d.power_after)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="small">No country can send help under these rules.</p>
        )}
        <p className="left-out">{leftOutSentence(plan.left_out)}</p>
      </div>
      <div className="panel-foot">
        <button className="btn-dark" type="button" onClick={() => window.print()}>
          Print briefing for responders
        </button>
        <p className="small" style={{ marginTop: 12, textAlign: "center" }}>
          Replay of {longDate(plan.date)} from NASA FIRMS
        </p>
      </div>
    </aside>
  );
}

function Bar({ label, value, color }) {
  return (
    <>
      <span>{label}</span>
      <span className="track">
        <b style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </span>
      <span className="val">{Math.round(value)}</span>
    </>
  );
}

function headline(plan) {
  const r = plan.recipient;
  const n = plan.donors.length;
  if (!n) return `No country can send help to ${r.name} under these rules`;
  const who = n === 1 ? "One country" : `${word(n)} countries`;
  const target = Math.round(r.power_with_help);
  const lift = r.power_with_help >= r.power_before - 0.5 ? "back to" : "up to";
  return `${who} can bring ${r.name} ${lift} ${target} within ${Math.round(plan.hours)} hours`;
}

function subline(plan, floor) {
  const r = plan.recipient;
  const need = Math.round(plan.need).toLocaleString("en-GB");
  if (!plan.donors.length) return `${r.name} needs about ${need} extra firefighters on ${longDate(plan.date)}. Try relaxing the rules on the left`;
  const rule = floor ? "Help comes from countries with power to spare, and none of them drops below 50 by sending it" : "Help comes from the countries that can get there fastest, even if it leaves them weaker";
  if (plan.shortfall > 0) return `${rule}. Together they cover ${plan.covered.toLocaleString("en-GB")} of the ${need} extra firefighters needed`;
  return rule;
}

export default function HelpPage({ params, setParams }) {
  const initial = {
    recipient: params.c && COUNTRY_NAMES[params.c] ? params.c : "GR",
    scenario: SCENARIOS.some(([id]) => id === params.s) ? params.s : "wildfire_season",
    floor: params.floor !== "0",
    skip: params.skip !== "0",
    fastest: params.fast !== "0"
  };
  const [form, setForm] = useState(initial);
  const key = JSON.stringify(initial) + params.date;
  const { data: plan, error, loading } = useFetch(
    () =>
      api.plan({
        recipient: initial.recipient,
        date: params.date,
        scenario: initial.scenario,
        min_power_after: initial.floor ? 50 : null,
        skip_active_fires: initial.skip,
        fastest_first: initial.fastest
      }),
    [key]
  );

  const run = () =>
    setParams({
      c: form.recipient,
      s: form.scenario === "wildfire_season" ? undefined : form.scenario,
      floor: form.floor ? undefined : "0",
      skip: form.skip ? undefined : "0",
      fast: form.fastest ? undefined : "0"
    });

  const donors = useMemo(() => Object.fromEntries((plan?.donors || []).map(d => [d.iso2, d])), [plan]);
  const leftOut = (plan?.left_out || []).map(l => l.iso2);
  const incident = plan ? plan.incident : null;
  const routes = (plan?.donors || []).map((d, i, all) => ({
    from: CENTROIDS[d.iso2],
    to: incident,
    width: 1.2 + 2 * (1 - i / Math.max(all.length, 1))
  }));

  const fill = iso2 => {
    if (donors[iso2]) return classColor(donors[iso2].power_before, POWER_STEPS, POWER_COLORS);
    if (plan && iso2 === plan.recipient.iso2) return classColor(plan.recipient.power_with_help, POWER_STEPS, POWER_COLORS);
    return "#dfe4ec";
  };

  return (
    <main className="layout layout-help">
      <Scenario form={form} setForm={setForm} onRun={run} busy={loading} />
      <section className="main">
        {error && <p className="notice">Could not run the plan: {error.message}</p>}
        {plan && (
          <>
            <h1 className="h1">{headline(plan)}</h1>
            <p className="sub">
              {subline(plan, initial.floor)}
            </p>
          </>
        )}
        {!plan && !error && <p className="loading">Running the plan…</p>}
        <EuropeMap
          fill={fill}
          selected={plan?.recipient.iso2}
          outline={plan ? plan.donors.map(d => d.iso2) : []}
          hatch={leftOut}
          routes={plan ? routes : []}
          incident={incident}
          focus={plan ? [incident, ...plan.donors.map(d => CENTROIDS[d.iso2]).filter(Boolean)] : null}
          ariaLabel="Countries sending help and their routes"
        />
        <div className="help-legend">
          <span>
            <i className="key-route" />
            Route, thicker arrives sooner
          </span>
          <span>
            <i className="key-sends" />
            Sends help
          </span>
          <span>
            <i className="key-left" />
            Left out
          </span>
        </div>
      </section>
      {plan ? <Side plan={plan} /> : <aside className="panel panel-right" />}
    </main>
  );
}
