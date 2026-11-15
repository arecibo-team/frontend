import { Fragment, useEffect, useMemo, useState } from "react";
import Segmented from "../components/Segmented.jsx";
import { api } from "../lib/api.js";
import { MONTHS, MONTHS_SHORT, dec, longDate, monthYear, num, ordinal, parseDate, partOfMonth, shortDay } from "../lib/format.js";
import { BAND_COLORS } from "../lib/geo.js";
import { DATA_FROM, DATA_TO, clampDate, iso, lastDay, presets } from "../lib/dates.js";
import { historySentence, normalSentence } from "../lib/sentences.js";
import { ContextCard, ReasonsCard, RegionsCompass, TrendCard } from "./Insights.jsx";

const RAMP = ["#fde9d9", "#fbcfa9", "#f6ad75", "#ec8346", "#d9581f", "#a63a10"];

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function Calendar({ data, mode, from, to, onRange, wide }) {
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
    <div className={`calendar${wide ? "" : " compact"}`} role="table" aria-label="Burning activity per month">
      <span />
      {MONTHS_SHORT.map(m => (
        <span key={m} className="mh">{wide ? m : m[0]}</span>
      ))}
      {wide ? <span className="mh mh-total">Year total</span> : <span />}
      {years.map((y, yi) => (
        <Fragment key={y}>
          <span className="yr">{wide ? y : `’${String(y).slice(2)}`}</span>
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
                title={label}
                aria-label={label}
                disabled={empty}
                onClick={e => pick(y, m, e.shiftKey)}
              />
            );
          })}
          {wide ? (
            <span className="total">
              <b className={y === curYear ? "now" : ""} style={{ width: `${(totals[yi] / maxTotal) * 92}px` }} />
              {num(totals[yi])}
            </span>
          ) : (
            <span className="total-mini" title={`${y}: ${num(totals[yi])} cell-days`}>
              <b className={y === curYear ? "now" : ""} style={{ width: `${(totals[yi] / maxTotal) * 100}%` }} />
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function CalendarLegend({ data, mode }) {
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
          From MODIS
        </span>
      )}
      <span>
        <i className="outline-key" />
        {MONTHS_SHORT[month - 1]} {year}
      </span>
      <span>
        <i className="range-key" />
        Selected
      </span>
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
            title={`${label(v)}: ${num(v.harmonized)} cell-days (MODIS ${num(v.modis)}, VIIRS ${num(v.viirs)})`}
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

function RangeControls({ from, to, asof, setParams }) {
  return (
    <>
      <div className="range-inputs">
        <input type="date" className="date" min={DATA_FROM} max={to} value={from} aria-label="From"
          onChange={e => e.target.value && setParams({ from: clampDate(e.target.value) })} />
        <span className="small">to</span>
        <input type="date" className="date" min={from} max={DATA_TO} value={to} aria-label="To"
          onChange={e => {
            if (!e.target.value) return;
            const t = clampDate(e.target.value);
            setParams(t > asof ? { to: t, date: t } : { to: t });
          }} />
      </div>
      <div className="chips">
        {presets(asof).map(([label, a, b]) => (
          <button key={label} type="button" className={`chip${a === from && b === to ? " on" : ""}`} onClick={() => setParams({ from: a, to: b })}>
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

function Range({ data, query, from, to, asof, setParams }) {
  const s = data.summary;
  const rn = data.range_normal;
  const by = s.detections_by_sensor;
  const year = parseDate(data.end).year;
  const downloads = [
    ["hotspots", "Hotspots", `${num(s.detections)} rows`],
    ["daily", "Daily counts", `${num(s.days)} rows`],
    ["calendar", "Monthly calendar", "since 2001"]
  ];
  return (
    <div className="range">
      <RangeControls from={from} to={to} asof={asof} setParams={setParams} />
      <div className="kpis">
        <div>
          <div className="label">Fire cell-days</div>
          <div className="big">{num(s.harmonized_cell_days)}</div>
        </div>
        <div>
          <div className="label">Against 2001–2020</div>
          <div className="big">{rn && rn.ratio != null ? `${Number(rn.ratio).toFixed(1)}×` : "–"}</div>
          {rn && <div className="small">{rn.rank === 1 ? "Highest" : ordinal(rn.rank)} of {rn.years} years</div>}
        </div>
        <div>
          <div className="label">Hotspots</div>
          <div className="big">{num(s.detections)}</div>
          <div className="small">
            VIIRS {num(by["VIIRS S-NPP"])} · MODIS {num(by["MODIS Terra"] + by["MODIS Aqua"])}
          </div>
        </div>
        <div>
          <div className="label">Fires</div>
          <div className="big">{num(s.fires)}</div>
          {s.max_frp > 0 && <div className="small">peak {num(s.max_frp)} MW</div>}
        </div>
      </div>
      <div className="range-grid">
        <div>
          <h3 className="h3">{data.series.unit === "day" ? "Per day" : "Per month"}</h3>
          <Bars values={data.series.values} unit={data.series.unit} highlight={s.busiest_day} />
        </div>
        {rn && (
          <div>
            <h3 className="h3">Same dates, every year</h3>
            <YearBars rows={rn.by_year} median={rn.median} current={year} />
          </div>
        )}
      </div>
      {data.fires.length > 0 && (
        <div className="block">
          <h3 className="h3">Fires</h3>
          <ol className="rank-list">
            {data.fires.slice(0, 5).map((f, i) => (
              <li key={`${f.name}-${f.start}-${i}`}>
                <span>{i + 1}</span>
                <span>
                  {f.name}, {shortDay(f.start)} {f.start.slice(0, 4)}
                </span>
                <span>{num(f.area_ha)} ha</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="downloads">
        <h3 className="h3">Download CSV</h3>
        <div className="download-row">
          {downloads.map(([kind, label, hint]) => (
            <a key={kind} className="download" href={api.areaCsvUrl(kind, query)} download>
              <b>{label}</b>
              <span>{hint}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Now({ data, country, onHelp, regions, focusRegion, box, onWeights }) {
  const n = data.normal;
  const o = data.outlook;
  const refLabel = country ? longDate(country.ref).replace(/ \d{4}$/, "") : "";
  const diff = country ? Math.round(country.power - country.power_ref) : 0;
  return (
    <div className="now">
      {country && (
        <>
          <div className="band">
            <i style={{ background: BAND_COLORS[country.band] }} />
            {country.band} band, Amber index {Math.round(country.amber)}
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
              <div className="delta">{ordinal(country.power_rank_ref)} on {refLabel}</div>
            </div>
          </div>
        </>
      )}
      {country && <RegionsCompass iso2={country.iso2} rows={regions?.data?.regions} power={country.power} focusRegion={focusRegion} loading={regions?.loading} />}
      <div className="block">
        <h3 className="h3">Is this normal</h3>
        <p className="normal-text">{country ? normalSentence(n, data.name) : `${historySentence(n)}.`}</p>
        <p className="small" style={{ marginTop: 6 }}>
          Usual {MONTHS[n.month - 1]}: {num(n.usual_low)} to {num(n.usual_high)} cell-days
        </p>
      </div>
      <ContextCard iso2={country ? country.iso2 : null} box={country ? null : box} date={data.date} />
      {country && <ReasonsCard iso2={country.iso2} />}
      {country && <TrendCard iso2={country.iso2} />}
      {country && (
        <div className="block">
          <h3 className="h3">What drives the score</h3>
          <div className="pillars">
            {[["Fire danger", country.danger, true], ["Other hazards", country.hazards], ["Workforce", country.workforce], ["Capability", country.capability]].map(([label, v, hot]) => (
              <Fragment key={label}>
                <span>{label}</span>
                <span className="track">
                  <b className={hot ? "hot" : ""} style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
                </span>
                <span className="val">{dec(v)}</span>
              </Fragment>
            ))}
          </div>
        </div>
      )}
      {o && (
        <div className="block">
          <h3 className="h3">Next {o.weeks} weeks, to {partOfMonth(o.until)}</h3>
          <div className="figures">
            <div>
              <div className="label">Share of a year</div>
              <div className="big">{Math.round(o.share * 100)}%</div>
            </div>
            <div>
              <div className="label">Typical week</div>
              <div className="big">{num(o.typical_week)}</div>
            </div>
            <div>
              <div className="label">Bad week</div>
              <div className="big">{num(o.bad_week)}</div>
            </div>
          </div>
        </div>
      )}
      {data.largest_fires.length > 0 && (
        <div className="block">
          <h3 className="h3">Largest fires since 2012</h3>
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
          {data.analog && <p className="small" style={{ marginTop: 10 }}>Closest year so far: {data.analog.year}</p>}
        </div>
      )}
      {country && (
        <div className="now-actions">
          {onHelp && (
            <button className="btn-dark" type="button" onClick={onHelp}>
              Find countries that can help
            </button>
          )}
          {onWeights && (
            <button className="btn" type="button" onClick={onWeights}>
              Adjust the index weights
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AreaPanel({ data, error, loading, country, wide, tab, mode, from, to, asof, query, setParams, onHelp, regions, focusRegion, box, onWeights }) {
  const [localTab, setLocalTab] = useState(tab || "now");
  useEffect(() => setLocalTab(tab || "now"), [tab]);
  if (error) return <p className="notice">Could not load this area: {error.message}</p>;
  if (!data) return <p className="loading">Loading…</p>;
  const calendar = (
    <div className="cal-wrap">
      <div className="cal-tools">
        <Segmented options={[["harmonized", "Harmonized"], ["raw", "Raw sensors"]]} value={mode}
          onChange={v => setParams({ mode: v === "harmonized" ? undefined : v })} label="Data view" />
      </div>
      <Calendar data={data} mode={mode} from={from} to={to} wide={wide} onRange={(a, b) => setParams({ from: a, to: b })} />
      <CalendarLegend data={data} mode={mode} />
    </div>
  );
  const range = <Range data={data} query={query} from={from} to={to} asof={asof} setParams={setParams} />;
  const now = <Now data={data} country={country} onHelp={onHelp} regions={regions} focusRegion={focusRegion} box={box} onWeights={onWeights} />;
  if (wide) {
    return (
      <div className={`area-wide${loading ? " busy" : ""}`}>
        <section>{calendar}</section>
        <section>{now}</section>
        <section className="span">{range}</section>
      </div>
    );
  }
  const select = t => {
    setLocalTab(t);
    setParams({ tab: t === "now" ? undefined : t });
  };
  return (
    <div className={loading ? "busy" : ""}>
      <div className="tabs">
        <Segmented options={[["now", "Now"], ["calendar", "Calendar"], ["range", "Range"]]} value={localTab} onChange={select} full label="Area view" />
      </div>
      {localTab === "now" && now}
      {localTab === "calendar" && calendar}
      {localTab === "range" && range}
    </div>
  );
}
