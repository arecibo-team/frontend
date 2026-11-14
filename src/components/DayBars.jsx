import { MONTHS, parseDate, shortDay } from "../lib/format.js";

export default function DayBars({ days, selected, onPick }) {
  if (!days?.length) return null;
  const max = Math.max(...days.map(d => d.value || 0), 1);
  const first = parseDate(days[0].date);
  const last = parseDate(days[days.length - 1].date);
  const idx = days.findIndex(d => d.date === selected);
  const mid = days.findIndex(d => parseDate(d.date).day === 15);
  const pct = i => `${((i + 0.5) / days.length) * 100}%`;
  const ticks = [
    { i: 0, cls: "first" },
    mid >= 0 && Math.abs(mid - idx) > 4 ? { i: mid } : null,
    idx >= 0 ? { i: idx, cls: "on" } : null,
    Math.abs(days.length - 1 - idx) > 4 ? { i: days.length - 1, cls: "last" } : null
  ].filter(Boolean);
  const range =
    first.month === last.month
      ? `${MONTHS[first.month - 1]} ${first.year}`
      : `${MONTHS[first.month - 1]} to ${MONTHS[last.month - 1]} ${last.year}`;

  return (
    <div className="days">
      <div className="days-head">
        <span>EU hotspots per day, harmonized</span>
        <span>{range}</span>
      </div>
      <div className="days-bars">
        {days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            className={i === idx ? "on" : ""}
            style={{ height: `${Math.max(3, ((d.value || 0) / max) * 100)}%` }}
            title={`${shortDay(d.date)}: ${Math.round(d.value || 0).toLocaleString("en-GB")} fire cell-days`}
            aria-label={`Replay ${shortDay(d.date)}`}
            onClick={() => onPick(d.date)}
          />
        ))}
      </div>
      <div className="days-axis">
        {ticks.map(t => (
          <span key={t.i} className={t.cls || ""} style={{ left: t.cls === "first" ? 0 : t.cls === "last" ? "100%" : pct(t.i) }}>
            {shortDay(days[t.i].date)}
          </span>
        ))}
      </div>
    </div>
  );
}
