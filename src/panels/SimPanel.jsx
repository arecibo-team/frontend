import { COUNTRY_NAMES } from "../lib/geo.js";
import { num } from "../lib/format.js";
import { ALERTS, ALERT_COLOR, HAZARDS, STORIES, summarize } from "../lib/sim.js";

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
        <span className="mono">{shock.count}</span>
        <button type="button" onClick={() => set({ count: Math.min(10, shock.count + 1) })} aria-label="More events">+</button>
      </div>
      <button type="button" className="icon-btn" onClick={onRemove} aria-label="Remove hazard">×</button>
    </div>
  );
}

function Dumbbell({ rows }) {
  const changed = rows.filter(r => r.shocked || Math.abs(r.power_change) >= 1).sort((a, b) => a.power_change - b.power_change);
  if (!changed.length) return <p className="small">No country's power changes in this scenario.</p>;
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
            <span className="db-val mono">
              {Math.round(r.power_before)}→{Math.round(r.power_after)}
            </span>
            {r.band_before !== r.band_after && <span className={`db-band band-${r.band_after.toLowerCase()}`}>{r.band_after}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function SimPanel({ draft, setDraft, onRun, result, error, loading, onHelp, wide, liveStory = [], liveLoading }) {
  const sum = result ? summarize(result.rows) : null;
  const run = list => onRun(list || draft);
  return (
    <div className={`sim${wide ? " sim-wide" : ""}`}>
      <section>
        <h3 className="h3">Scenarios</h3>
        <button
          type="button"
          className="story story-live"
          disabled={loading || liveLoading || !liveStory.length}
          onClick={() => { setDraft(liveStory); run(liveStory); }}
        >
          <b><i className="live-dot" />Hazards happening now</b>
          <span>{liveLoading ? "Reading GDACS…" : liveStory.length ? "Every current GDACS alert in the EU, added to the replay day" : "No current GDACS alerts in the EU"}</span>
          {liveStory.length > 0 && (
            <span className="story-chips">
              {[...new Set(liveStory.map(x => x.iso2))].slice(0, 10).map(c => (
                <i key={c}>{c}</i>
              ))}
            </span>
          )}
        </button>
        <div className="stories">
          {STORIES.map(st => (
            <button key={st.id} type="button" className="story" onClick={() => { setDraft(st.shocks); run(st.shocks); }} disabled={loading}>
              <b>{st.title}</b>
              <span>{st.text}</span>
              <span className="story-chips">
                {[...new Set(st.shocks.map(x => x.iso2))].map(c => (
                  <i key={c}>{c}</i>
                ))}
              </span>
            </button>
          ))}
        </div>
        <h3 className="h3" style={{ marginTop: 18 }}>Hazards</h3>
        <div className="shocks">
          {draft.map((x, i) => (
            <ShockRow
              key={i}
              shock={x}
              onChange={v => setDraft(draft.map((y, j) => (j === i ? v : y)))}
              onRemove={() => setDraft(draft.filter((_, j) => j !== i))}
            />
          ))}
          <button
            type="button"
            className="add-shock"
            onClick={() => setDraft([...draft, { iso2: draft.at(-1)?.iso2 || "GR", type: "WF", alert: "Orange", count: 1 }])}
          >
            + Add hazard
          </button>
        </div>
        <button className="btn-dark" type="button" onClick={() => run()} disabled={loading || !draft.length} style={{ marginTop: 14 }}>
          {loading ? "Simulating…" : "Run simulation"}
        </button>
        {error && <p className="notice">Could not run the simulation: {error.message}</p>}
      </section>

      {result && sum && (
        <section className="sim-result">
          <h3 className="plan-head">
            {sum.worst && sum.worst.power_change < -0.05
              ? `${sum.worst.name} falls from ${Math.round(sum.worst.power_before)} to ${Math.round(sum.worst.power_after)}`
              : "No country loses power"}
          </h3>
          <p className="small">
            {sum.hit} {sum.hit === 1 ? "country" : "countries"} hit. EU average power {sum.avgBefore.toFixed(1)} → {sum.avgAfter.toFixed(1)}
          </p>
          <div className="sim-kpis">
            <div>
              <div className="label">Below 50</div>
              <div className="big">
                {sum.belowBefore}
                <span className="arrow">→</span>
                <em>{sum.belowAfter}</em>
              </div>
            </div>
            <div>
              <div className="label">Red band</div>
              <div className="big">
                {sum.redBefore}
                <span className="arrow">→</span>
                <em>{sum.redAfter}</em>
              </div>
            </div>
            <div>
              <div className="label">Firefighters tied up</div>
              <div className="big">{num(sum.committed)}</div>
            </div>
            <div>
              <div className="label">Need left uncovered</div>
              <div className="big">{num(sum.unmet)}</div>
            </div>
          </div>
          <h3 className="h3">Power before and after</h3>
          <div className="db-legend small">
            <span><b className="db-before" /> before</span>
            <span><b className="db-after" /> after</span>
            <span><i className="db-fifty-key" /> 50</span>
          </div>
          <Dumbbell rows={result.rows} />
          {sum.worst && sum.worst.power_change < -0.05 && (
            <button className="btn-dark" type="button" style={{ marginTop: 16 }} onClick={() => onHelp(sum.worst.iso2)}>
              Find help for {sum.worst.name}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

