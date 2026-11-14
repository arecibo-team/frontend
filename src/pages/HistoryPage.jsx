import { Fragment, useMemo } from "react";
import Segmented from "../components/Segmented.jsx";
import { api } from "../lib/api.js";
import { MONTHS, MONTHS_SHORT, longDate, monthYear, num, parseDate, partOfMonth, word } from "../lib/format.js";
import { historySentence } from "../lib/sentences.js";
import { useFetch } from "../lib/useFetch.js";

const RAMP = ["#fde9d9", "#fbcfa9", "#f6ad75", "#ec8346", "#d9581f", "#a63a10"];
const REPLAY_FROM = "2012-01-20";
const REPLAY_TO = "2025-12-31";

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function dateIn(year, month, day) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const d = `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
  if (d < REPLAY_FROM || d > REPLAY_TO) return null;
  return d;
}

function Calendar({ data, mode, onPick }) {
  const { year: curYear, month: curMonth, day: curDay } = parseDate(data.date);
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
            const future = y === curYear && m > curMonth;
            const v = cell?.[key] || 0;
            const target = cell && !future ? dateIn(y, m, curDay) : null;
            const current = y === curYear && m === curMonth;
            const cls = ["cell", future || !cell ? "empty" : "", mode !== "raw" && cell?.modelled ? "hatch" : "", current ? "current" : "", target ? "click" : ""]
              .filter(Boolean)
              .join(" ");
            const label = `${MONTHS[i]} ${y}: ${future || !cell ? "no data" : `${num(v)} cell-days${cell.partial ? " so far" : ""}`}`;
            return (
              <button
                key={m}
                type="button"
                className={cls}
                style={{ background: future || !cell ? undefined : color(v) }}
                title={label}
                aria-label={label}
                disabled={!target}
                onClick={() => target && onPick(target)}
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
    </div>
  );
}

function Side({ data }) {
  const n = data.normal;
  const month = MONTHS[n.month - 1];
  const o = data.outlook;
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
            {Math.round(o.share * 100)}% of a year's burning in {data.name} usually happens between now and {partOfMonth(o.until)}.
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
          <p className="small">No fire in {data.name} reached 10 detections since 2012.</p>
        )}
        {data.analog && (
          <p className="small" style={{ marginTop: 14 }}>
            So far, {parseDate(data.date).year} looks most like {data.analog.year}
            {data.analog.largest_fire ? `, the year of the ${data.analog.largest_fire} fire` : ""}
          </p>
        )}
      </div>
      <p className="small panel-foot">Replay of {longDate(data.date)} from NASA FIRMS</p>
    </aside>
  );
}

export default function HistoryPage({ params, setParams }) {
  const iso2 = params.c || "GR";
  const mode = params.mode === "raw" ? "raw" : "harmonized";
  const { data, error } = useFetch(() => api.history(iso2, params.date), [iso2, params.date]);
  const lastYear = data ? parseDate(data.date).year : null;

  return (
    <main className="layout layout-history">
      <section className="main">
        {error && <p className="notice">Could not load the history: {error.message}</p>}
        {!data && !error && <p className="loading">Loading the history…</p>}
        {data && (
          <>
            <div className="history-head">
              <div>
                <h1 className="h1">
                  {data.name}, {data.first_year} to {lastYear}
                </h1>
                <p className="sub">
                  Burning activity per month, counted in 1 km cells with at least one hotspot on a given day. Before 2012 only
                  MODIS was flying, so those months are converted to the VIIRS scale.
                </p>
              </div>
              <Segmented
                options={[["raw", "Raw sensors"], ["harmonized", "Harmonized"]]}
                value={mode}
                onChange={v => setParams({ mode: v === "harmonized" ? undefined : v })}
                label="Data view"
              />
            </div>
            <div className="calendar-card">
              <Calendar data={data} mode={mode} onPick={d => setParams({ date: d })} />
              <Legend data={data} mode={mode} />
            </div>
            <p className="caption">
              {mode === "raw"
                ? "Raw sensors. Before 2012 only MODIS was flying. Its pixels are larger and it passes less often, so those years look quieter than they were."
                : `Harmonized. The years before 2012 are on the same scale as VIIRS, using a ratio fitted for ${data.name} and each month on 2013 to 2022, when both sensors flew. The step at 2012 is gone because it came from the sensor change, not from the fires. On years held out from the fit the conversion is off by about ${Math.round(data.validation_error_pct)}%.`}
            </p>
          </>
        )}
      </section>
      {data && <Side data={data} />}
    </main>
  );
}
