import { COUNTRY_NAMES } from "../lib/geo.js";
import { dayMonth, hours, possessive } from "../lib/format.js";
import { SCENARIOS, headline, leftOutSentence } from "../lib/plan.js";

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

export default function HelpPanel({ form, setForm, onRun, plan, error, loading, wide }) {
  const names = Object.entries(COUNTRY_NAMES).sort((a, b) => a[1].localeCompare(b[1]));
  const set = patch => setForm({ ...form, ...patch });
  const r = plan?.recipient;
  return (
    <div className={`help${wide ? " help-wide" : ""}`}>
      <div className="help-form">
        <label className="label" htmlFor="recipient">Country that needs help</label>
        <select id="recipient" className="select" value={form.recipient} onChange={e => set({ recipient: e.target.value })}>
          {names.map(([iso2, name]) => (
            <option key={iso2} value={iso2}>{name}</option>
          ))}
        </select>
        <fieldset>
          <legend className="label">Facing</legend>
          <div className="radios">
            {SCENARIOS.map(([id, label]) => (
              <label key={id} className="radio">
                <input type="radio" name="scenario" checked={form.scenario === id} onChange={() => set({ scenario: id })} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Rules</legend>
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
        <button className="btn-dark" type="button" onClick={onRun} disabled={loading}>
          {loading ? "Planning…" : "Run the plan"}
        </button>
      </div>
      {error && <p className="notice">Could not run the plan: {error.message}</p>}
      {plan && (
        <div className="help-result">
          <h3 className="plan-head">{headline(plan)}</h3>
          <div className="block">
            <h3 className="h3">{possessive(r.name)} power</h3>
            <div className="power-bars">
              <Bar label={`Before, ${dayMonth(plan.reference_date)}`} value={r.power_before} color="#a8acb3" />
              <Bar label="After the fires" value={r.power_after} color="#d9480f" />
              <Bar label="With help" value={r.power_with_help} color="#18181b" />
            </div>
          </div>
          <div className="block">
            <h3 className="h3">In order of arrival</h3>
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
            {plan.left_out.length > 0 && <p className="left-out">{leftOutSentence(plan.left_out)}</p>}
          </div>
          <button className="btn" type="button" onClick={() => window.print()} style={{ width: "100%", justifyContent: "center" }}>
            Print briefing
          </button>
        </div>
      )}
    </div>
  );
}
