import { useMemo, useState } from "react";
import EuropeMap from "../components/EuropeMap.jsx";
import DayBars from "../components/DayBars.jsx";
import Segmented from "../components/Segmented.jsx";
import { api } from "../lib/api.js";
import { AMBER_COLORS, AMBER_STEPS, BAND_COLORS, POWER_COLORS, POWER_STEPS, classColor, fireRadius } from "../lib/geo.js";
import { MONTHS, dayMonth, dec, longDate, num, ordinal, possessive, ratio } from "../lib/format.js";
import { normalSentence } from "../lib/sentences.js";
import { useFetch } from "../lib/useFetch.js";

const FILTERS = [["all", "All"], ["above", "Above normal"], ["watch", "Watch"]];
const STATUS_COLOR = { above: "#d9480f", watch: "#e7a33e", normal: "#c5c8cd" };

function FireList({ data, filter, onFilter, selectedId, onPick }) {
  const fires = data?.fires || [];
  const shown = filter === "all" ? fires : fires.filter(f => f.status === filter);
  return (
    <aside className="panel panel-left">
      <div className="fires-head">
        <h2 className="h2">Active fires</h2>
        <span className="small" style={{ fontSize: 13 }}>{data ? `${data.counts.all} in the EU` : ""}</span>
      </div>
      <div className="fires-filter">
        <Segmented options={FILTERS} value={filter} onChange={onFilter} full label="Filter fires" />
      </div>
      <div className="fire-list">
        {shown.map(f => (
          <button key={f.id} type="button" className={`fire${f.id === selectedId ? " on" : ""}`} onClick={() => onPick(f)}>
            <i className="dot" style={{ background: STATUS_COLOR[f.status] }} />
            <span className="name">{f.name}</span>
            <span className={`ratio ${f.status === "above" ? "above" : ""}`}>{ratio(f.ratio)}</span>
            <span className="meta">
              {f.country}, {num(f.detections)} hotspots, day {f.day}
            </span>
            <span className="pass">
              {f.last_sensor} {f.last_time}
            </span>
          </button>
        ))}
        {data && shown.length === 0 && <p className="fires-empty">No fires in this group on {dayMonth(data.date)}.</p>}
      </div>
      <p className="fires-note">
        The ratio compares this month with the harmonized 2001–2020 median for the same area, about 250 km across. Replay of{" "}
        {data ? longDate(data.date) : "…"} from NASA FIRMS
      </p>
    </aside>
  );
}

function CountryPanel({ country, data, onHelp, onHistory }) {
  if (!country) return <aside className="panel panel-right"><p className="loading">Select a country on the map</p></aside>;
  const refLabel = data ? dayMonth(data.reference_date) : "";
  const diff = Math.round(country.power - country.power_ref);
  const pillars = [
    ["Fire danger", country.danger, true],
    ["Other hazards", country.hazards, false],
    ["Workforce", country.workforce, false],
    ["Capability", country.capability, false]
  ];
  return (
    <aside className="panel panel-right">
      <h2 className="country-name">{country.name}</h2>
      <div className="band">
        <i style={{ background: BAND_COLORS[country.band] }} />
        {country.band} band, Amber index {Math.round(country.amber)} of 100
      </div>
      <div className="stats">
        <div className="stat">
          <div className="label">Power</div>
          <div className="big">{Math.round(country.power)}</div>
          <div className={`delta${diff < 0 ? " down" : ""}`}>
            {diff < 0 ? `${-diff} lower than on ${refLabel}` : diff > 0 ? `${diff} higher than on ${refLabel}` : `Same as on ${refLabel}`}
          </div>
        </div>
        <div className="stat">
          <div className="label">Rank in the EU</div>
          <div className="big">
            {country.power_rank} <small>of 27</small>
          </div>
          <div className="delta">
            {ordinal(country.power_rank_ref)} on {refLabel}
          </div>
        </div>
      </div>
      <div className="block">
        <h3 className="h3">Is this normal</h3>
        <p className="normal-text">{normalSentence(country.normal, country.name)}</p>
      </div>
      <div className="block">
        <h3 className="h3">What drives the score</h3>
        <div className="pillars">
          {pillars.map(([label, v, hot]) => (
            <FragmentRow key={label} label={label} value={v} hot={hot} />
          ))}
        </div>
      </div>
      <div className="panel-foot">
        <button className="btn-dark" type="button" onClick={onHelp}>
          Find countries that can help
        </button>
        <button className="link" type="button" onClick={onHistory}>
          Open {possessive(country.name)} fire history
        </button>
      </div>
    </aside>
  );
}

function FragmentRow({ label, value, hot }) {
  return (
    <>
      <span>{label}</span>
      <span className="track">
        <b className={hot ? "hot" : ""} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
      </span>
      <span className="val">{dec(value)}</span>
    </>
  );
}

function Legend({ layer }) {
  const power = layer === "power";
  const steps = power ? [0, ...POWER_STEPS] : [0, ...AMBER_STEPS];
  const colors = power ? POWER_COLORS : AMBER_COLORS;
  return (
    <div className="map-legend">
      <div>
        <div className="legend-title">{power ? "Power, from stretched to strong" : "Amber index, from small to large gap"}</div>
        <div className="ramp">
          {colors.map(c => <span key={c} style={{ background: c }} />)}
        </div>
        <div className="ramp-ticks">
          {steps.map(s => <span key={s}>{s}</span>)}
        </div>
      </div>
      <div>
        <div className="legend-title">Satellite hotspots, last 24 hours</div>
        <div className="bubbles">
          {[50, 500, 1200].map(v => (
            <span key={v}>
              <i style={{ width: fireRadius(v) * 2, height: fireRadius(v) * 2 }} />
              {v.toLocaleString("en-GB")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MapPage({ params, setParams, go }) {
  const date = params.date;
  const layer = params.layer === "amber" ? "amber" : "power";
  const showFires = params.fires !== "0";
  const filter = ["above", "watch"].includes(params.filter) ? params.filter : "all";
  const { data, error, loading } = useFetch(() => api.replay(date), [date]);

  const byIso = useMemo(() => Object.fromEntries((data?.countries || []).map(c => [c.iso2, c])), [data]);
  const fires = data?.fires || [];
  const defaultCountry = useMemo(() => {
    if (!data) return null;
    const top = fires.find(f => f.status === "above") || fires[0];
    return top ? top.iso2 : data.countries[data.countries.length - 1]?.iso2;
  }, [data]);
  const selected = params.c && byIso[params.c] ? params.c : defaultCountry;
  const country = selected ? byIso[selected] : null;
  const selectedFire = fires.find(f => f.id === params.fire) || null;
  const calloutFire = selectedFire || fires.filter(f => f.iso2 === selected).sort((a, b) => b.ratio - a.ratio)[0];
  const month = data ? MONTHS[Number(data.date.slice(5, 7)) - 1] : "";
  const [drawing, setDrawing] = useState(false);

  const fill = iso2 => {
    const c = byIso[iso2];
    if (!c) return "#dfe3e8";
    return layer === "power" ? classColor(c.power, POWER_STEPS, POWER_COLORS) : classColor(c.amber, AMBER_STEPS, AMBER_COLORS);
  };

  return (
    <main className="layout layout-map">
      <FireList
        data={data}
        filter={filter}
        onFilter={f => setParams({ filter: f === "all" ? undefined : f })}
        selectedId={selectedFire?.id}
        onPick={f => setParams({ c: f.iso2, fire: f.id })}
      />
      <section className="main">
        <h1 className="h1">{layer === "power" ? "Firefighting power across the EU" : "Amber index across the EU"}</h1>
        <p className="sub">
          {layer === "power"
            ? "How much of its fire service a country can still use, after the hazards it is already fighting"
            : "Fire danger and other hazards against the firefighters, money and stations to meet them. Higher is a bigger gap"}
        </p>
        <div className="map-tools">
          <Segmented options={[["power", "Power"], ["amber", "Amber index"]]} value={layer} onChange={v => setParams({ layer: v === "power" ? undefined : v })} label="Map layer" />
          <label className="check check-ink">
            <input type="checkbox" checked={showFires} onChange={e => setParams({ fires: e.target.checked ? undefined : "0" })} />
            Fires
          </label>
          <button className={`btn btn-small${drawing ? " btn-on" : ""}`} type="button" onClick={() => setDrawing(d => !d)}>
            {drawing ? "Cancel" : "Draw an area"}
          </button>
        </div>
        {error && <p className="notice">Could not load the replay: {error.message}</p>}
        <EuropeMap
          fill={fill}
          selected={selected}
          onSelect={drawing ? undefined : iso2 => setParams({ c: iso2, fire: undefined })}
          drawing={drawing}
          onDraw={b => go("history", { box: b.join(","), c: undefined, date })}
          fires={showFires ? fires : []}
          callout={
            showFires && calloutFire
              ? { lat: calloutFire.lat, lon: calloutFire.lon, title: calloutFire.name, sub: `${dec(calloutFire.ratio, 1)} times the ${month} median` }
              : null
          }
          flyTo={selectedFire ? [selectedFire.lat, selectedFire.lon] : null}
          flyOnSelect
          ariaLabel={layer === "power" ? "Firefighting power by EU country" : "Amber index by EU country"}
        />
        <Legend layer={layer} />
        {data && <DayBars days={data.eu_daily} selected={data.date} onPick={d => setParams({ date: d, fire: undefined })} />}
        {loading && !data && <p className="loading">Loading the replay…</p>}
      </section>
      <CountryPanel
        country={country}
        data={data}
        onHelp={() => go("help", { c: selected, date })}
        onHistory={() => go("history", { c: selected, date })}
      />
    </main>
  );
}
