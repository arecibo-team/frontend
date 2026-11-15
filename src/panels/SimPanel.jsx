import { COUNTRY_NAMES } from "../lib/geo.js";
import { num } from "../lib/format.js";
import { ALERTS, ALERT_COLOR, HAZARDS, STORIES, summarize } from "../lib/sim.js";
import { Section } from "./Insights.jsx";

const NAMES = Object.entries(COUNTRY_NAMES).sort((a, b) => a[1].localeCompare(b[1]));

function ShockRow({ shock, onChange, onRemove }) {
  const set = patch => onChange({ ...shock, ...patch });
  return (
    <div className="shock">
      <select className="select select-sm" value={shock.iso2} onChange={e => set({ iso2: e.target.value })} aria-label="Country">
        {NAMES.map(([k, n]) => (
          <option key={k} value={k}>{n}</option>
        ))}
      </select>
      <select className="select select-sm" value={shock.type} onChange={e => set({ type: e.target.value })} aria-label="Hazard">
        {HAZARDS.map(([k, n]) => (
          <option key={k} value={k}>{n}</option>
        ))}
      </select>
      <div className="alert-pick" role="radiogroup" aria-label="Alert level">
        {ALERTS.map(a => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={shock.alert === a}
            title={`${a} alert`}
            className={shock.alert === a ? "on" : ""}
            style={{ "--c": ALERT_COLOR[a] }}
            onClick={() => set({ alert: a })}
          />
        ))}
      </div>
      <div className="stepper">
        <button type="button" onClick={() => set({ count: Math.max(1, shock.count - 1) })} aria-label="Fewer events">−</button>
        <span className="num">{shock.count}</span>
        <button type="button" onClick={() => set({ count: Math.min(10, shock.count + 1) })} aria-label="More events">+</button>
      </div>
      <button type="button" className="icon-btn" onClick={onRemove} aria-label="Remove hazard">×</button>
    </div>
  );
}

function Dumbbell({ rows }) {
  const changed = rows.filter(r => r.shocked || Math.abs(r.power_change) >= 1).sort((a, b) => a.power_change - b.power_change);
  if (!changed.length) return <p className="quiet">No change</p>;
  return (
    <div className="dumbbells">
      {changed.map(r => {
        const a = Math.max(0, Math.min(100, r.power_before));
        const b = Math.max(0, Math.min(100, r.power_after));
        return (
          <div key={r.iso2} className={`dumbbell${r.shocked ? " hit" : ""}`}>
            <span className="db-name">{r.name}</span>
            <span className="db-track">
              <i className="db-fifty" />
              <i className="db-line" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />
              <b className="db-before" style={{ left: `${a}%` }} />
              <b className="db-after" style={{ left: `${b}%` }} />
            </span>
            <span className="db-val num">
              {Math.round(r.power_before)} → {Math.round(r.power_after)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function SimPanel({ draft, setDraft, onRun, result, error, loading, onHelp, wide, liveStory = [], liveLoading }) {
  const sum = result ? summarize(result.rows) : null;
  const run = list => onRun(list || draft);
  const stories = [
    { id: "live", title: "Hazards now, from GDACS", shocks: liveStory, off: liveLoading || !liveStory.length, live: true },
    ...STORIES
  ];
  return (
    <div className={`sim${wide ? " sim-wide" : ""}`}>
      <div>
        <Section title="Scenarios">
          <ul className="picklist">
            {stories.map(st => (
              <li key={st.id}>
                <button type="button" disabled={loading || st.off} onClick={() => { setDraft(st.shocks); run(st.shocks); }}>
                  <span>{st.live && <i className="live-dot" />}{st.title}</span>
                  <span className="quiet num">{[...new Set(st.shocks.map(x => x.iso2))].slice(0, 8).join(" ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Hazards">
          <div className="shocks">
            {draft.map((x, i) => (
              <ShockRow
                key={i}
                shock={x}
                onChange={v => setDraft(draft.map((y, j) => (j === i ? v : y)))}
                onRemove={() => setDraft(draft.filter((_, j) => j !== i))}
              />
            ))}
          </div>
          <div className="actions row">
            <button type="button" className="btn" onClick={() => setDraft([...draft, { iso2: draft.at(-1)?.iso2 || "GR", type: "WF", alert: "Orange", count: 1 }])}>
              Add hazard
            </button>
            <button className="btn-dark" type="button" onClick={() => run()} disabled={loading || !draft.length}>
              Run simulation
            </button>
          </div>
          {error && <p className="notice">Could not run the simulation: {error.message}</p>}
        </Section>
      </div>

      {result && sum && (
        <div className="result">
          <p className="lede">
            {sum.worst && sum.worst.power_change < -0.05
              ? `${sum.worst.name} falls from ${Math.round(sum.worst.power_before)} to ${Math.round(sum.worst.power_after)}.`
              : "No country loses power."}
          </p>
          <div className="metrics">
            <div className="metric"><span className="metric-v num">{sum.belowBefore}<span className="down"> → {sum.belowAfter}</span></span><span className="metric-l">Below 50</span></div>
            <div className="metric"><span className="metric-v num">{sum.redBefore}<span className="down"> → {sum.redAfter}</span></span><span className="metric-l">Red band</span></div>
            <div className="metric"><span className="metric-v num">{num(sum.committed)}</span><span className="metric-l">Crews tied up</span></div>
            <div className="metric"><span className="metric-v num">{num(sum.unmet)}</span><span className="metric-l">Uncovered</span></div>
          </div>
          <Section title="Power" aside="before, after">
            <Dumbbell rows={result.rows} />
          </Section>
          {sum.worst && sum.worst.power_change < -0.05 && (
            <div className="actions">
              <button className="btn-dark" type="button" onClick={() => onHelp(sum.worst.iso2)}>
                Find help for {sum.worst.name}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
