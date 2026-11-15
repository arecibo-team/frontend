import Segmented from "../components/Segmented.jsx";
import { COUNTRY_NAMES } from "../lib/geo.js";
import { listJoin, longDate, num } from "../lib/format.js";
import { Pending, REGION_LABEL, Section } from "./Insights.jsx";

const NAMES = Object.entries(COUNTRY_NAMES).sort((a, b) => a[1].localeCompare(b[1]));
const REASON = {
  "weaker than recipient": name => `weaker than ${name}`,
  "below floor": () => "below power 50",
  "would drop below": () => "would drop below 50",
  "own fires": () => "crews on their own fires",
  "small force": () => "too few spare crews"
};

function hoursText(h) {
  return h < 1 ? "now" : `${Math.round(h)} h`;
}

export function planSentence(p) {
  const when = longDate(p.date);
  if (p.status === "no_fires") return `No active fires in ${p.name} on ${when}.`;
  if (p.status === "local") return `${p.name} covers its fires with local crews.`;
  if (p.status === "national") return `${p.name} covers its fires by moving ${num(p.national)} firefighters between its regions.`;
  const who = p.donors.length === 1 ? p.donors[0].name : `${p.donors.length} countries`;
  if (p.status === "short") {
    return `${p.name} is ${num(p.abroad_needed)} firefighters short. Only ${num(p.abroad)} can be sent under these rules.`;
  }
  return `${p.name} is ${num(p.abroad_needed)} firefighters short. ${who} can close the gap in ${Math.round(p.hours)} hours.`;
}

function Metric({ value, label }) {
  return (
    <div className="metric">
      <span className="metric-v num">{value}</span>
      <span className="metric-l">{label}</span>
    </div>
  );
}

function Delta({ before, after }) {
  const a = Math.round(before);
  const b = Math.round(after);
  return (
    <span className="num">
      {a}
      {a !== b && <span className={b > a ? "better" : "worse"}> → {b}</span>}
    </span>
  );
}

export default function HelpPanel({ form, setForm, onRun, plan, error, loading, wide }) {
  const set = patch => setForm({ ...form, ...patch });
  const p = plan;
  const groups = {};
  (p?.left_out || []).forEach(l => (groups[l.reason] = [...(groups[l.reason] || []), l.name]));
  return (
    <div className={`help${wide ? " help-wide" : ""}`}>
      <form className="controls" onSubmit={e => { e.preventDefault(); onRun(); }}>
        <label className="field">
          <span>Country</span>
          <select className="select" value={form.recipient} onChange={e => set({ recipient: e.target.value })}>
            {NAMES.map(([iso2, name]) => (
              <option key={iso2} value={iso2}>{name}</option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Fire load</span>
          <Segmented options={[["1", "As detected"], ["1.5", "× 1.5"], ["2", "× 2"]]} value={String(form.load)} onChange={v => set({ load: Number(v) })} full label="Fire load" />
        </div>
        <div className="field">
          <span>Send first</span>
          <Segmented options={[["fast", "Fastest"], ["strong", "Strongest"]]} value={form.fastest ? "fast" : "strong"} onChange={v => set({ fastest: v === "fast" })} full label="Priority" />
        </div>
        <label className="check">
          <input type="checkbox" checked={form.half} onChange={e => set({ half: e.target.checked })} />
          Donors keep half their spare crews
        </label>
        <label className="check">
          <input type="checkbox" checked={form.floor} onChange={e => set({ floor: e.target.checked })} />
          No donor drops below power 50
        </label>
        <button className="btn-dark" type="submit" disabled={loading}>Run the plan</button>
      </form>

      {error && <p className="notice">Could not run the plan: {error.message}</p>}
      {!p && loading && <Pending rows={5} />}
      {p && (
        <div className="result">
          <p className="lede">{planSentence(p)}</p>
          {p.status !== "no_fires" && (
            <>
              <div className="metrics">
                <Metric value={num(p.need)} label="Fires need" />
                <Metric value={num(p.sustainable)} label="Sustainable" />
                <Metric value={num(p.abroad_needed)} label="From abroad" />
                <Metric value={`${Math.round(p.coverage_after * 100)}%`} label={p.hours ? `Covered in ${hoursText(p.hours)}` : "Covered"} />
              </div>

              <Section title="Regions" aside="power">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th />
                      <th className="r">Need</th>
                      <th className="r">Local</th>
                      <th className="r">Moved in</th>
                      <th className="r">Before, after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.regions.map(g => (
                      <tr key={g.region} className={g.region === p.incident_region && g.need > g.capacity ? "is-strained" : ""}>
                        <th scope="row">{REGION_LABEL[g.region]}</th>
                        <td className="r num">{g.need ? num(g.need) : "–"}</td>
                        <td className="r num">{g.local ? num(g.local) : "–"}</td>
                        <td className="r num">{g.from_country + g.from_abroad ? num(g.from_country + g.from_abroad) : g.sent ? `−${num(g.sent)}` : "–"}</td>
                        <td className="r"><Delta before={g.power_before} after={g.power_after} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              <Section title="Arrivals" aside="fires covered">
                <ol className="arrivals">
                  {p.timeline.map((s, i) => (
                    <li key={i} className={`a-${s.kind}`}>
                      <span className="num a-h">{hoursText(s.h)}</span>
                      <span className="a-who">{s.label}{s.mode === "air" ? ", by air" : ""}</span>
                      <span className="num a-n">{num(s.firefighters)}</span>
                      <span className="a-bar"><b style={{ width: `${s.coverage * 100}%` }} /></span>
                      <span className="num a-c">{Math.round(s.coverage * 100)}%</span>
                    </li>
                  ))}
                </ol>
              </Section>

              {p.donors.length > 0 && (
                <Section title="Donors" aside="power">
                  <table className="tbl">
                    <tbody>
                      {p.donors.map(d => (
                        <tr key={d.iso2}>
                          <th scope="row">{d.name}{d.region ? <span className="quiet">, {d.region}</span> : null}</th>
                          <td className="r num">{num(d.sent)}</td>
                          <td className="r"><Delta before={d.power_before} after={d.power_after} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {Object.keys(groups).length > 0 && (
                <Section title="Not sending">
                  <ul className="reasons plain">
                    {Object.entries(groups).map(([reason, names]) => (
                      <li key={reason}>
                        <span>{listJoin(names)}</span>
                        <span className="quiet">{(REASON[reason] || (() => reason))(p.name)}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              <div className="actions">
                <button className="btn" type="button" onClick={() => window.print()}>Print briefing</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
