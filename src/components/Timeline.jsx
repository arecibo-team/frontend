import { useRef, useState } from "react";
import Segmented from "./Segmented.jsx";
import { MONTHS_SHORT, num, shortDay, monthYear } from "../lib/format.js";
import { DATA_TO, REPLAY_FROM, iso, lastDay } from "../lib/dates.js";

function span(v, unit) {
  if (unit === "day") return [v.date, v.date];
  const y = Number(v.date.slice(0, 4));
  const m = Number(v.date.slice(5, 7));
  const end = iso(y, m, lastDay(y, m));
  return [v.date, end > DATA_TO ? DATA_TO : end];
}

export default function Timeline({ series, from, to, day, mode, year, onMode, onYear, onRange, onDay, label, loading }) {
  const box = useRef(null);
  const [drag, setDrag] = useState(null);
  const values = series?.values || [];
  const unit = series?.unit || "day";
  const max = Math.max(...values.map(v => v.harmonized), 1);

  const indexAt = e => {
    const r = box.current.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * values.length);
    return Math.max(0, Math.min(values.length - 1, i));
  };
  const down = e => {
    if (!values.length) return;
    box.current.setPointerCapture(e.pointerId);
    const i = indexAt(e);
    setDrag({ a: i, b: i });
  };
  const move = e => drag && setDrag({ ...drag, b: indexAt(e) });
  const up = () => {
    if (!drag) return;
    const lo = Math.min(drag.a, drag.b);
    const hi = Math.max(drag.a, drag.b);
    setDrag(null);
    const a = span(values[lo], unit)[0];
    const b = span(values[hi], unit)[1];
    if (lo === hi && unit === "day" && a >= REPLAY_FROM) onDay(a);
    else onRange(a, b);
  };

  const [rf, rt] = drag
    ? [span(values[Math.min(drag.a, drag.b)], unit)[0], span(values[Math.max(drag.a, drag.b)], unit)[1]]
    : [from, to];
  const ticks = values
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => (unit === "day" ? v.date.endsWith("-01") : v.date.endsWith("-01-01") && Number(v.date.slice(0, 4)) % 2 === 1));
  const first = values[0]?.date.slice(0, 4);

  return (
    <div className="timeline">
      <div className="timeline-head">
        <span className="timeline-label">
          {label}
          <span className="small">
            {" "}
            {drag ? `${unit === "day" ? shortDay(rf) : monthYear(rf)} – ${unit === "day" ? shortDay(rt) : monthYear(rt)}` : "drag to select, click to replay"}
          </span>
        </span>
        <div className="timeline-tools">
          {mode === "year" && (
            <div className="year-step">
              <button type="button" className="icon-btn" onClick={() => onYear(year - 1)} disabled={year <= 2001} aria-label="Previous year">
                ‹
              </button>
              <span className="mono">{year}</span>
              <button type="button" className="icon-btn" onClick={() => onYear(year + 1)} disabled={year >= 2025} aria-label="Next year">
                ›
              </button>
            </div>
          )}
          <Segmented options={[["year", "Year"], ["all", "2001–2025"]]} value={mode} onChange={onMode} label="Timeline span" />
        </div>
      </div>
      <div
        className={`timeline-bars${loading ? " busy" : ""}`}
        ref={box}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        role="slider"
        aria-label="Select a date range"
        aria-valuetext={`${from} to ${to}`}
      >
        {values.map(v => {
          const [a, b] = span(v, unit);
          const inRange = b >= rf && a <= rt;
          const isDay = unit === "day" && v.date === day;
          return (
            <span
              key={v.date}
              className={`${inRange ? "in" : ""}${isDay ? " day" : ""}`}
              style={{ height: `${Math.max(2, (v.harmonized / max) * 100)}%` }}
              title={`${unit === "day" ? shortDay(v.date) + " " + v.date.slice(0, 4) : monthYear(v.date)}: ${num(v.harmonized)} cell-days`}
            />
          );
        })}
      </div>
      <div className="timeline-axis">
        {ticks.map(({ v, i }) => (
          <span key={v.date} style={{ left: `${(i / Math.max(values.length, 1)) * 100}%` }}>
            {unit === "day" ? MONTHS_SHORT[Number(v.date.slice(5, 7)) - 1] : v.date.slice(0, 4)}
          </span>
        ))}
        {!ticks.length && first && <span style={{ left: 0 }}>{first}</span>}
      </div>
    </div>
  );
}
