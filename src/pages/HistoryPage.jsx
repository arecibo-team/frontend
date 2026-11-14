import { Fragment, useEffect, useMemo, useState } from "react";
import EuropeMap from "../components/EuropeMap.jsx";
import Segmented from "../components/Segmented.jsx";
import { api } from "../lib/api.js";
import { MONTHS, MONTHS_SHORT, longDate, monthYear, num, ordinal, parseDate, partOfMonth, shortDay, word } from "../lib/format.js";
import { COUNTRY_NAMES } from "../lib/geo.js";
import { historySentence } from "../lib/sentences.js";
import { useFetch } from "../lib/useFetch.js";

const RAMP = ["#fde9d9", "#fbcfa9", "#f6ad75", "#ec8346", "#d9581f", "#a63a10"];
const DATA_FROM = "2001-01-01";
const DATA_TO = "2025-12-31";

const pad = n => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const clampDate = d => (d < DATA_FROM ? DATA_FROM : d > DATA_TO ? DATA_TO : d);

function addDays(d, n) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function Calendar({ data, mode, from, to, onRange }) {
  const { year: curYear, month: curMonth } = parseDate(data.date);
  const key = mode === "raw" ? "raw" : "harmonized";
  const cells = useMemo(() => Object.fromEntries(data.months.map(m => [`${m.year}-${m.month}`, m])), [data]);
  const years = [];
  for (let y = data.first_year; y <= curYear; y++) years.push(y);

  const steps = useMemo(() => {
    const vals = data.months.map(m => m[key]).filter(v => v > 0).sort((a, b) => a - b);
    return [0.3, 0.5, 0.7, 0.85, 0.95].map(q => quantile(vals, q));
  }, [data, key]);
  const color = v => {
    if (!v) return "#f1f2f4";
    let i = 0;
    while (i < steps.length && v >= steps[i]) i++;
    return RAMP[i];
  };

  const totals = years.map(y => {
    let t = 0;
    for (let m = 1; m <= 12; m++) t += cells[`${y}-${m}`]?.[key] || 0;
    return t;
  });
  const maxTotal = Math.max(...totals, 1);

  const pick = (y, m, extend) => {
    const start = iso(y, m, 1);
    const monthEnd = iso(y, m, lastDay(y, m));
    const end = monthEnd > data.date ? data.date : monthEnd;
    if (extend) onRange(start < from ? start : from, end > to ? end : to);
    else onRange(start, end);
  };

  return (
    <div className="calendar" role="table" aria-label="Fire activity per month">
      <span />
      {MONTHS_SHORT.map(m => (
        <span key={m} className="mh">{m}</span>
      ))}
      <span className="mh mh-total">Year total</span>
      {years.map((y, yi) => (
        <Fragment key={y}>
          <span className="yr">{y}</span>
          {MONTHS_SHORT.map((_, i) => {
            const m = i + 1;
            const cell = cells[`${y}-${m}`];
            const empty = !cell || cell[key] == null;
            const v = cell?.[key] || 0;
            const current = y === curYear && m === curMonth;
            const inRange = iso(y, m, lastDay(y, m)) >= from && iso(y, m, 1) <= to;
            const cls = ["cell", empty ? "empty" : "click", mode !== "raw" && cell?.modelled ? "hatch" : "", current ? "current" : "", inRange && !current ? "inrange" : ""]
              .filter(Boolean)
              .join(" ");
            const label = `${MONTHS[i]} ${y}: ${empty ? "no data" : `${num(v)} cell-days${cell.partial ? " so far" : ""}`}`;
            return (
              <button
                key={m}
                type="button"
                className={cls}
                style={{ background: empty ? undefined : color(v) }}
                title={`${label}. Click to select, shift-click to extend the range`}
                aria-label={label}
                disabled={empty}
                onClick={e => pick(y, m, e.shiftKey)}
              />
            );
          })}
          <span className="total">
            <b className={y === curYear ? "now" : ""} style={{ width: `${(totals[yi] / maxTotal) * 92}px` }} />
            {num(totals[yi])}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function Legend({ data, mode }) {
  const { year, month } = parseDate(data.date);
  return (
    <div className="cal-legend">
      <span>
        Fewer
        <span className="swatches">
          {RAMP.map(c => <i key={c} style={{ background: c }} />)}
        </span>
        More
      </span>
      {mode !== "raw" && (
        <span>
          <i className="hatch-key" />
          Modelled from MODIS
        </span>
      )}
      <span>
        <i className="outline-key" />
        {MONTHS[month - 1]} {year}
      </span>
      <span>
        <i className="range-key" />
        Selected range
      </span>
    </div>
  );
}

function presets(asof) {
  const { year, month } = parseDate(asof);
  const season = iso(year, 6, 1) > asof ? year - 1 : year;
  const seasonEnd = iso(season, 9, 30) < asof ? iso(season, 9, 30) : asof;
  return [
    ["This month", iso(year, month, 1), asof],
    ["Last 30 days", clampDate(addDays(asof, -29)), asof],
    ["Fire season, Jun–Sep", iso(season, 6, 1), seasonEnd],
    ["This year", iso(year, 1, 1), asof],
    ["Last 5 years", clampDate(iso(year - 4, 1, 1)), asof],
    ["Whole record", DATA_FROM, asof]
  ];
}

function BoxFields({ box, onBox }) {
  const [vals, setVals] = useState(box || ["", "", "", ""]);
  const [point, setPoint] = useState({ lat: "", lon: "", km: "25" });
  useEffect(() => setVals(box || ["", "", "", ""]), [box?.join(",")]);
  const labels = ["West", "South", "East", "North"];
  const valid = vals.every(v => v !== "" && !Number.isNaN(Number(v))) && Number(vals[0]) < Number(vals[2]) && Number(vals[1]) < Number(vals[3]);
  const usePoint = () => {
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    const km = Number(point.km);
    if (![lat, lon, km].every(Number.isFinite) || km <= 0) return;
    const dLat = km / 111.32;
    const dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180));
    const r = v => Math.round(v * 100) / 100;
    onBox([r(lon - dLon), r(lat - dLat), r(lon + dLon), r(lat + dLat)]);
  };
  return (
    <div className="box-fields">
      <form
        className="coords"
        onSubmit={e => {
          e.preventDefault();
          if (valid) onBox(vals.map(Number));
        }}
      >
        {labels.map((l, i) => (
          <label key={l}>
            <span>{l}</span>
            <input
              inputMode="decimal"
              value={vals[i]}
              onChange={e => setVals(v => v.map((x, j) => (j === i ? e.target.value : x)))}
              aria-label={`${l} edge in degrees`}
            />
          </label>
        ))}
        <button className="btn" type="submit" disabled={!valid}>
          Use box
        </button>
      </form>
      <form
        className="coords"
        onSubmit={e => {
          e.preventDefault();
          usePoint();
        }}
      >
        <label>
          <span>Latitude</span>
          <input inputMode="decimal" value={point.lat} onChange={e => setPoint({ ...point, lat: e.target.value })} />
        </label>
        <label>
          <span>Longitude</span>
          <input inputMode="decimal" value={point.lon} onChange={e => setPoint({ ...point, lon: e.target.value })} />
        </label>
        <label>
          <span>Within km</span>
          <input inputMode="decimal" value={point.km} onChange={e => setPoint({ ...point, km: e.target.value })} />
        </label>
        <button className="btn" type="submit">
          Use point
        </button>
      </form>
    </div>
  );
}

function Query({ setParams, from, to, asof, box, iso2 }) {
  const [drawing, setDrawing] = useState(false);
  const kind = box ? "box" : "country";
  const names = Object.entries(COUNTRY_NAMES).sort((a, b) => a[1].localeCompare(b[1]));
  const setBox = b => {
    setDrawing(false);
    setParams({ box: b.join(","), c: undefined });
  };
  return (
    <div className="query-card">
      <div className="query-row">
        <div className="query-group">
          <span className="label">Area</span>
          <Segmented
            options={[["country", "Country"], ["box", "Custom area"]]}
            value={kind}
            onChange={v => (v === "country" ? setParams({ box: undefined, c: iso2 || "GR" }) : setDrawing(true))}
            label="Area type"
          />
          {kind === "country" ? (
            <select className="select select-inline" value={iso2} onChange={e => setParams({ c: e.target.value, box: undefined })} aria-label="Country">
              {names.map(([k, n]) => (
                <option key={k} value={k}>{n}</option>
              ))}
            </select>
          ) : null}
          <button className={`btn${drawing ? " btn-on" : ""}`} type="button" onClick={() => setDrawing(d => !d)}>
            {drawing ? "Cancel drawing" : box ? "Redraw on map" : "Draw on map"}
          </button>
        </div>
        <div className="query-group">
          <span className="label">Dates</span>
          <input
            type="date"
            className="date"
            min={DATA_FROM}
            max={to}
            value={from}
            onChange={e => e.target.value && setParams({ from: clampDate(e.target.value) })}
            aria-label="From"
          />
          <span className="small">to</span>
          <input
            type="date"
            className="date"
            min={from}
            max={DATA_TO}
            value={to}
            onChange={e => {
              if (!e.target.value) return;
              const t = clampDate(e.target.value);
              setParams(t > asof ? { to: t, date: t } : { to: t });
            }}
            aria-label="To"
          />
        </div>
      </div>
      <div className="chips">
        {presets(asof).map(([label, a, b]) => (
          <button key={label} type="button" className={`chip${a === from && b === to ? " on" : ""}`} onClick={() => setParams({ from: a, to: b })}>
            {label}
          </button>
        ))}
      </div>
      {(drawing || kind === "box") && (
        <div className="draw-wrap">
          <div className="draw-map">
            <EuropeMap
              fill={() => "#e6edf6"}
              drawing={drawing}
              onDraw={setBox}
              box={box}
              focus={box && !drawing ? [[box[1], box[0]], [box[3], box[2]]] : null}
              ariaLabel="Draw an area of interest"
            />
          </div>
          <BoxFields box={box} onBox={setBox} />
          <p className="small">
            Drag a box on the map, type its edges in degrees, or give a point and a distance. Hotspot data covers the 27 EU
            countries.
          </p>
        </div>
      )}
    </div>
  );
}

function Bars({ values, unit, highlight }) {
  if (!values.length) return null;
  const max = Math.max(...values.map(v => v.harmonized), 1);
  const label = v => (unit === "day" ? shortDay(v.date) : monthYear(v.date));
  return (
    <div className="range-chart">
      <div className="range-bars">
        {values.map(v => (
          <span
            key={v.date}
            className={v.date === highlight ? "on" : ""}
            style={{ height: `${Math.max(2, (v.harmonized / max) * 100)}%` }}
            title={`${label(v)}: ${num(v.harmonized)} harmonized cell-days (MODIS ${num(v.modis)}, VIIRS ${num(v.viirs)})`}
          />
        ))}
      </div>
      <div className="range-axis">
        <span>{label(values[0])}</span>
        {values.length > 1 && <span>{label(values[values.length - 1])}</span>}
      </div>
    </div>
  );
}

function YearBars({ rows, median, current }) {
  const max = Math.max(...rows.map(r => r.value), median, 1);
  return (
    <div className="year-chart">
      <div className="year-bars">
        {rows.map(r => (
          <span key={r.year} title={`${r.year}: ${num(r.value)} cell-days`}>
            <b className={r.year === current ? "now" : ""} style={{ height: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </span>
        ))}
        <i className="median-line" style={{ bottom: `${(median / max) * 100}%` }} title={`2001–2020 median: ${num(median)}`} />
      </div>
      <div className="range-axis">
        <span>{rows[0]?.year}</span>
        <span>median {num(median)}</span>
        <span>{rows[rows.length - 1]?.year}</span>
      </div>
    </div>
  );
}

function compareText(rn, days) {
  if (!rn) return "Ranges longer than a year are not compared with other years.";
  if (!rn.median) return `The same ${days} days usually see almost no burning here.`;
  return `Times the 2001–2020 median for the same dates. ${rn.rank === 1 ? "The highest" : ordinal(rn.rank)} of ${rn.years} years.`;
}

function RangeCard({ data, query }) {
  const s = data.summary;
  const rn = data.range_normal;
  const by = s.detections_by_sensor;
  const year = parseDate(data.end).year;
  const downloads = [
    ["hotspots", "Hotspots", `${num(s.detections)} rows, one per detection`],
    ["daily", "Daily counts", `${num(s.days)} rows`],
    ["calendar", "Monthly calendar", "every month since 2001"]
  ];
  return (
    <div className="range-card">
      <div className="range-head">
        <div>
          <h2 className="h2">Selected range</h2>
          <p className="small">
            {longDate(data.start)} to {longDate(data.end)}, {num(s.days)} {s.days === 1 ? "day" : "days"}
          </p>
        </div>
      </div>
      <div className="kpis">
        <div>
          <div className="label">Harmonized fire cell-days</div>
          <div className="big">{num(s.harmonized_cell_days)}</div>
          <div className="small">on the VIIRS scale</div>
        </div>
        <div>
          <div className="label">Against other years</div>
          <div className="big">{rn && rn.ratio != null ? `${Number(rn.ratio).toFixed(1)}×` : "–"}</div>
          <div className="small">{compareText(rn, s.days)}</div>
        </div>
        <div>
          <div className="label">Hotspots detected</div>
          <div className="big">{num(s.detections)}</div>
          <div className="small">
            VIIRS {num(by["VIIRS S-NPP"])}, MODIS Terra {num(by["MODIS Terra"])}, Aqua {num(by["MODIS Aqua"])}
          </div>
        </div>
        <div>
          <div className="label">Fires</div>
          <div className="big">{num(s.fires)}</div>
          <div className="small">
            {s.max_frp ? `strongest pixel ${num(s.max_frp)} MW, ${Math.round(s.night_share * 100)}% seen at night` : "no hotspots"}
          </div>
        </div>
      </div>
      <div className="range-grid">
        <div>
          <h3 className="h3">{data.series.unit === "day" ? "Per day" : "Per month"}, harmonized</h3>
          <Bars values={data.series.values} unit={data.series.unit} highlight={s.busiest_day} />
          {s.busiest_day && <p className="small">Busiest day: {longDate(s.busiest_day)}</p>}
        </div>
        <div>
          <h3 className="h3">Same dates in every year</h3>
          {rn ? <YearBars rows={rn.by_year} median={rn.median} current={year} /> : <p className="small">Pick a range of a year or less to compare it across years.</p>}
        </div>
      </div>
      {data.fires.length > 0 && (
        <div className="block">
          <h3 className="h3">Fires in this range</h3>
          <ol className="rank-list">
            {data.fires.slice(0, 5).map((f, i) => (
              <li key={`${f.name}-${f.start}-${i}`}>
                <span>{i + 1}</span>
                <span>
                  {f.name}, {f.iso2}, {shortDay(f.start)} {f.start.slice(0, 4)}
                </span>
                <span>
                  {num(f.detections)} hotspots, {num(f.area_ha)} ha
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="downloads">
        <h3 className="h3">Download</h3>
        <div className="download-row">
          {downloads.map(([kind, label, hint]) => (
            <a key={kind} className="download" href={api.areaCsvUrl(kind, query)} download>
              <b>{label} CSV</b>
              <span>{hint}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Side({ data }) {
  const n = data.normal;
  const month = MONTHS[n.month - 1];
  const o = data.outlook;
  const where = data.kind === "country" ? data.name : "this area";
  return (
    <aside className="panel panel-right">
      <div className="block">
        <h3 className="h3">Is this normal</h3>
        <p className="big-sentence">{historySentence(n)}</p>
        <p className="normal-text" style={{ fontSize: 14, color: "var(--ink-2)" }}>
          A usual {month} is {num(n.usual_low)} to {num(n.usual_high)} cell-days. This one has {num(n.value)} so far
        </p>
      </div>
      {o && (
        <div className="block">
          <h3 className="h3">Next {word(o.weeks).toLowerCase()} weeks</h3>
          <p className="normal-text">
            {Math.round(o.share * 100)}% of a year's burning in {where} usually happens between now and {partOfMonth(o.until)}.
          </p>
          <div className="figures">
            <div>
              <div className="label">Typical week</div>
              <div className="big">{num(o.typical_week)}</div>
            </div>
            <div>
              <div className="label">Bad week, 1 in 10</div>
              <div className="big">{num(o.bad_week)}</div>
            </div>
          </div>
        </div>
      )}
      <div className="block">
        <h3 className="h3">Largest fires since 2012</h3>
        {data.largest_fires.length ? (
          <ol className="rank-list">
            {data.largest_fires.map((f, i) => (
              <li key={`${f.name}-${f.start}`}>
                <span>{i + 1}</span>
                <span>
                  {f.name}, {monthYear(f.start)}
                </span>
                <span>{num(f.area_ha)} ha</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="small">No fire in {where} reached 10 detections since 2012.</p>
        )}
        {data.analog && (
          <p className="small" style={{ marginTop: 14 }}>
            So far, {parseDate(data.date).year} looks most like {data.analog.year}
            {data.analog.largest_fire ? `, the year of the ${data.analog.largest_fire} fire` : ""}
          </p>
        )}
      </div>
      <p className="small panel-foot">Harmonized NASA FIRMS hotspots, MODIS and VIIRS S-NPP</p>
    </aside>
  );
}

export function areaParams(params) {
  const box = params.box ? params.box.split(",").map(Number) : null;
  const validBox = box && box.length === 4 && box.every(Number.isFinite) && box[0] < box[2] && box[1] < box[3] ? box : null;
  const date = clampDate(params.date);
  const to = clampDate(params.to || date);
  const asof = to > date ? to : date;
  const fromRaw = clampDate(params.from || `${to.slice(0, 7)}-01`);
  const from = fromRaw > to ? to : fromRaw;
  return { box: validBox, iso2: validBox ? null : params.c && COUNTRY_NAMES[params.c] ? params.c : "GR", from, to, asof };
}

export default function HistoryPage({ params, setParams }) {
  const { box, iso2, from, to, asof } = areaParams(params);
  const mode = params.mode === "raw" ? "raw" : "harmonized";
  const query = { country: iso2, box: box ? box.join(",") : null, from, to, asof };
  const { data, error, loading } = useFetch(() => api.area(query), [iso2, box?.join(","), from, to, asof]);
  const lastYear = data ? parseDate(data.date).year : null;
  const title = data ? (data.kind === "country" ? data.name : "Custom area") : "";

  return (
    <main className="layout layout-history">
      <section className="main">
        <div className="history-head">
          <div>
            <h1 className="h1">{data ? `${title}, ${data.first_year} to ${lastYear}` : "Fire history"}</h1>
            <p className="sub">
              {data && data.kind === "box" ? `${data.name}, about ${num(data.area_km2)} km². ` : ""}
              Burning activity per month, counted in 1 km cells with at least one hotspot on a given day. Before 2012 only MODIS
              was flying, so those months are converted to the VIIRS scale.
            </p>
          </div>
          <Segmented
            options={[["raw", "Raw sensors"], ["harmonized", "Harmonized"]]}
            value={mode}
            onChange={v => setParams({ mode: v === "harmonized" ? undefined : v })}
            label="Data view"
          />
        </div>
        <Query setParams={setParams} from={from} to={to} asof={asof} box={box} iso2={iso2} />
        {error && <p className="notice">Could not load this area: {error.message}</p>}
        {!data && !error && <p className="loading">Loading the history…</p>}
        {data && (
          <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
            <div className="calendar-card">
              <Calendar data={data} mode={mode} from={from} to={to} onRange={(a, b) => setParams({ from: a, to: b })} />
              <Legend data={data} mode={mode} />
            </div>
            <p className="caption">
              {mode === "raw"
                ? "Raw sensors. Before 2012 only MODIS was flying. Its pixels are larger and it passes less often, so those years look quieter than they were."
                : `Harmonized. The years before 2012 are on the same scale as VIIRS, using a ratio fitted for each country and month on 2013 to 2022, when both sensors flew. The step at 2012 is gone because it came from the sensor change, not from the fires.${data.validation_error_pct != null ? ` On years held out from the fit the conversion is off by about ${Math.round(data.validation_error_pct)}%.` : ""} Click a month to select it, shift-click to extend the range.`}
            </p>
            <RangeCard data={data} query={query} />
          </div>
        )}
      </section>
      {data && <Side data={data} />}
    </main>
  );
}
