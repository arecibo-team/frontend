import { Fragment, useEffect, useMemo, useState } from "react";
import Segmented from "../components/Segmented.jsx";
import { api } from "../lib/api.js";
import { MONTHS, MONTHS_SHORT, dec, longDate, monthYear, num, ordinal, parseDate, partOfMonth, shortDay } from "../lib/format.js";
import { BAND_COLORS } from "../lib/geo.js";
import { DATA_FROM, DATA_TO, clampDate, iso, lastDay, presets } from "../lib/dates.js";
import { historySentence, normalSentence } from "../lib/sentences.js";
import { FuelDryness, Pending, ReasonsList, RegionsTable, Section, Trend } from "./Insights.jsx";

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
    <div className="range-controls">
      <div className="range-inputs">
        <input type="date" className="date" min={DATA_FROM} max={to} value={from} aria-label="From"
          onChange={e => e.target.value && setParams({ from: clampDate(e.target.value) })} />
        <span className="quiet">to</span>
        <input type="date" className="date" min={from} max={DATA_TO} value={to} aria-label="To"
          onChange={e => {
            if (!e.target.value) return;
            const t = clampDate(e.target.value);
            setParams(t > asof ? { to: t, date: t } : { to: t });
          }} />
      </div>
      <div className="presets" role="group" aria-label="Preset ranges">
        {presets(asof).map(([label, a, b]) => (
          <button key={label} type="button" className={a === from && b === to ? "on" : ""} onClick={() => setParams({ from: a, to: b })}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Metric({ value, label, note, tone }) {
  return (
    <div className="metric">
      <span className="metric-v num">{value}</span>
      <span className="metric-l">{label}</span>
      {note && <span className={`metric-d${tone ? ` ${tone}` : ""}`}>{note}</span>}
    </div>
  );
}

function Range({ data, query, from, to, asof, setParams }) {
  const s = data.summary;
  const rn = data.range_normal;
  const by = s.detections_by_sensor;
  const year = parseDate(data.end).year;
  const downloads = [
    ["hotspots", "Hotspots", num(s.detections)],
    ["daily", "Daily counts", num(s.days)],
    ["calendar", "Monthly calendar", "2001–"]
  ];
  return (
    <div className="range">
      <RangeControls from={from} to={to} asof={asof} setParams={setParams} />
      <div className="metrics">
        <Metric value={num(s.harmonized_cell_days)} label="Fire cell-days" />
        <Metric value={rn && rn.ratio != null ? `${Number(rn.ratio).toFixed(1)}×` : "–"} label="vs 2001–2020"
          note={rn ? `${rn.rank === 1 ? "Highest" : ordinal(rn.rank)} of ${rn.years}` : null} tone={rn && rn.rank <= 3 ? "up" : null} />
        <Metric value={num(s.detections)} label="Hotspots" note={`VIIRS ${num(by["VIIRS S-NPP"])}, MODIS ${num(by["MODIS Terra"] + by["MODIS Aqua"])}`} />
        <Metric value={num(s.fires)} label="Fires" note={s.max_frp > 0 ? `peak ${num(s.max_frp)} MW` : null} />
      </div>
      <Section title={data.series.unit === "day" ? "Per day" : "Per month"}>
        <Bars values={data.series.values} unit={data.series.unit} highlight={s.busiest_day} />
      </Section>
      {rn && (
        <Section title="Same dates, every year">
          <YearBars rows={rn.by_year} median={rn.median} current={year} />
        </Section>
      )}
      {data.fires.length > 0 && (
        <Section title="Fires">
          <table className="tbl">
            <tbody>
              {data.fires.slice(0, 5).map((f, i) => (
                <tr key={`${f.name}-${f.start}-${i}`}>
                  <th scope="row">{f.name}</th>
                  <td className="quiet">{shortDay(f.start)} {f.start.slice(0, 4)}</td>
                  <td className="r num">{num(f.area_ha)} ha</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      <Section title="Download CSV">
        <ul className="links">
          {downloads.map(([kind, label, hint]) => (
            <li key={kind}>
              <a href={api.areaCsvUrl(kind, query)} download>{label}</a>
              <span className="num quiet">{hint}</span>
            </li>
          ))}
        </ul>
      </Section>
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
        <div className="metrics metrics-3">
          <Metric value={Math.round(country.power)} label="Power" note={diff ? `${diff > 0 ? "+" : "−"}${Math.abs(diff)} since ${refLabel}` : `same as ${refLabel}`} tone={diff < 0 ? "down" : null} />
          <Metric value={<>{country.power_rank}<small>/27</small></>} label="Rank" note={`${ordinal(country.power_rank_ref)} on ${refLabel}`} />
          <Metric value={Math.round(country.amber)} label="Amber index" note={<><i className="band-dot" style={{ background: BAND_COLORS[country.band] }} />{country.band}</>} />
        </div>
      )}
      <Section title={`${MONTHS[n.month - 1]} ${n.year}`} aside={`usual ${num(n.usual_low)}–${num(n.usual_high)}`}>
        <p className="lede">{country ? normalSentence(n, data.name) : `${historySentence(n)}.`}</p>
      </Section>
      {country && <RegionsTable iso2={country.iso2} rows={regions?.data?.regions} focusRegion={focusRegion} loading={regions?.loading} />}
      {country && (
        <Section title="Score drivers">
          <div className="pillars">
            {[["Fire danger", country.danger, true], ["Other hazards", country.hazards], ["Workforce", country.workforce], ["Capability", country.capability]].map(([label, v, hot]) => (
              <Fragment key={label}>
                <span>{label}</span>
                <span className="track">
                  <b className={hot ? "hot" : ""} style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
                </span>
                <span className="val num">{dec(v)}</span>
              </Fragment>
            ))}
          </div>
        </Section>
      )}
      {country && <ReasonsList iso2={country.iso2} />}
      {country && <Trend iso2={country.iso2} />}
      <FuelDryness iso2={country ? country.iso2 : null} box={country ? null : box} date={data.date} />
      {o && (
        <Section title={`Next ${o.weeks} weeks`} aside={`to ${partOfMonth(o.until)}`}>
          <dl className="defs">
            <div><dt>Share of a year's fire</dt><dd className="num">{Math.round(o.share * 100)}%</dd></div>
            <div><dt>Typical week</dt><dd className="num">{num(o.typical_week)}</dd></div>
            <div><dt>Bad week, 1 in 10</dt><dd className="num">{num(o.bad_week)}</dd></div>
          </dl>
        </Section>
      )}
      {data.largest_fires.length > 0 && (
        <Section title="Largest since 2012" aside={data.analog ? `closest year ${data.analog.year}` : null}>
          <table className="tbl">
            <tbody>
              {data.largest_fires.map(f => (
                <tr key={`${f.name}-${f.start}`}>
                  <th scope="row">{f.name}</th>
                  <td className="quiet">{monthYear(f.start)}</td>
                  <td className="r num">{num(f.area_ha)} ha</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      {country && (
        <div className="actions">
          {onHelp && <button className="btn-dark" type="button" onClick={onHelp}>Find help</button>}
          {onWeights && <button className="btn" type="button" onClick={onWeights}>Reweigh the index</button>}
        </div>
      )}
    </div>
  );
}

export default function AreaPanel({ data, error, loading, country, wide, tab, mode, from, to, asof, query, setParams, onHelp, regions, focusRegion, box, onWeights }) {
  const [localTab, setLocalTab] = useState(tab || "now");
  useEffect(() => setLocalTab(tab || "now"), [tab]);
  if (error) return <p className="notice">Could not load this area: {error.message}</p>;
  if (!data) return <Pending rows={6} />;
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
