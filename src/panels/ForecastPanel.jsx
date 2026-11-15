import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Segmented from "../components/Segmented.jsx";
import { api } from "../lib/api.js";
import { addDays } from "../lib/dates.js";
import { longDate, num, shortDay } from "../lib/format.js";
import { STATE_LABEL, WAR, dayState, riskColor, riskValue, riskWord, tally } from "../lib/forecast.js";
import { Pending, Section } from "./Insights.jsx";

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");

function Metric({ value, label }) {
  return (
    <div className="metric">
      <span className="metric-v num">{value}</span>
      <span className="metric-l">{label}</span>
    </div>
  );
}

function EventChart({ r }) {
  const W = 328, H = 112, ml = 24, mb = 16, mt = 6;
  const days = r.days;
  if (days.length < 2) return null;
  const max = Math.max(1, ...days.map(d => Math.max(d.burning, d.risk)));
  const bw = (W - ml) / days.length;
  const x = i => ml + i * bw;
  const y = v => mt + (1 - v / max) * (H - mt - mb);
  const [s0, s1] = r.event.spike;
  const line = days.map((d, i) => `${(x(i) + bw / 2).toFixed(1)},${y(d.risk).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fc-chart" role="img" aria-label="Cells that burned against the expected number, per day of the held-out window">
      {days.map((d, i) => d.date >= s0 && d.date <= s1 && <rect key={`s${d.date}`} className="fc-spike" x={x(i)} y={mt} width={bw} height={H - mt - mb} />)}
      <line className="fc-axis" x1={ml} x2={W} y1={H - mb} y2={H - mb} />
      {days.map((d, i) => (
        <rect key={d.date} className="fc-bar" x={x(i) + 1} y={y(d.burning)} width={Math.max(bw - 2, 1)} height={H - mb - y(d.burning)}>
          <title>{`${d.date}: ${d.burning} burned, ${d.risk.toFixed(1)} expected`}</title>
        </rect>
      ))}
      <polyline className="fc-line" points={line} />
      <text x={0} y={mt + 8}>{Math.round(max)}</text>
      <text x={ml} y={H - 3}>{shortDay(days[0].date)}</text>
      <text x={W} y={H - 3} textAnchor="end">{shortDay(days[days.length - 1].date)}</text>
    </svg>
  );
}

function EventCheck({ run, onJump }) {
  const r = run?.metrics?.benchmark;
  if (!r) return null;
  const { event, horizon } = r;
  const dayBefore = addDays(event.spike[0], -1);
  const eve = r.days.find(d => d.date === dayBefore);
  const caught = eve ? eve.real : 0;
  const burned = eve ? eve.burning : 0;
  const share = burned ? caught / burned : 0;
  const verdict = share >= 0.7 ? "Seen coming" : share >= 0.4 ? "Partly seen" : "Missed";
  return (
    <Section title="Held-out event" aside={`${shortDay(event.first)} to ${shortDay(event.last)}`}>
      <p className="fc-verdict">
        <b className={share >= 0.4 ? "" : "is-bad"}>{verdict}.</b> {event.name}: on {shortDay(dayBefore)} the model flagged {caught} of the {burned} cells that burned in the next {horizon} days ({pct(caught, burned)}).
      </p>
      <EventChart r={r} />
      <div className="fc-keys small">
        <span><i className="key key-bar" />Burned, next {horizon} days</span>
        <span><i className="key key-rule" />Expected</span>
        <span><i className="key key-band" />Surge</span>
      </div>
      <table className="tbl fc-lead">
        <thead>
          <tr>
            <th>Surge cells flagged</th>
            {r.lead_days.map(k => <th key={k} className="r">{k} d</th>)}
          </tr>
        </thead>
        <tbody>
          {[["new", "New"], ["burning", "Already burning"]].map(([k, label]) => (
            <tr key={k}>
              <th scope="row">{label} <span className="quiet num">{r.lead[k].cells}</span></th>
              {r.lead_days.map(d => <td key={d} className="r num">{r.lead[k].flagged[String(d)]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="defs">
        <div><dt>PR-AUC, all of Europe</dt><dd className="num">{r.europe.pr_auc?.toFixed(2) ?? "n/a"} <span className="quiet">vs {r.europe.baseline_pr_auc?.toFixed(2) ?? "n/a"} persistence</span></dd></div>
        <div><dt>Recall, precision</dt><dd className="num">{Math.round(r.europe.recall * 100)}%, {Math.round(r.europe.precision * 100)}%</dd></div>
      </dl>
      <div className="actions">
        <button className="btn" type="button" onClick={() => onJump(dayBefore)}>Show {shortDay(dayBefore)}</button>
      </div>
    </Section>
  );
}

function LossChart({ points }) {
  if (points.length < 2) return null;
  const W = 328, H = 80, m = 4;
  const vals = points.flatMap(p => [p.train, p.val]).filter(v => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const x0 = points[0].round, x1 = points[points.length - 1].round;
  const sx = r => m + ((r - x0) / Math.max(x1 - x0, 1)) * (W - 2 * m);
  const sy = v => H - m - ((v - lo) / Math.max(hi - lo, 1e-9)) * (H - 2 * m);
  const line = key => points.filter(p => p[key] != null).map(p => `${sx(p.round).toFixed(1)},${sy(p[key]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fc-chart" role="img" aria-label="Training and validation loss per round">
      <polyline className="fc-line fc-train" points={line("train")} />
      <polyline className="fc-line" points={line("val")} />
      <text x={m} y={10}>{hi.toFixed(3)}</text>
      <text x={m} y={H - 6}>{lo.toFixed(3)}</text>
    </svg>
  );
}

function Training({ runs, refresh, horizon, onModelChanged }) {
  const [rounds, setRounds] = useState(300);
  const [history, setHistory] = useState([]);
  const [total, setTotal] = useState(0);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const es = useRef(null);
  const running = Boolean(runs?.running);
  const shown = runs?.active ?? runs?.runs?.[0]?.id;

  const connect = useCallback(() => {
    es.current?.close();
    const source = new EventSource(api.firms.streamUrl());
    es.current = source;
    source.onmessage = m => {
      const ev = JSON.parse(m.data);
      if (ev.type === "start") {
        setTotal(ev.total);
        if (ev.replay || !ev.resumed) setHistory([]);
        setNote(null);
        refresh();
      } else if (ev.type === "progress") {
        setHistory(h => [...h.filter(p => p.round < ev.round), { round: ev.round, train: ev.train_loss, val: ev.val_loss }]);
        setTotal(ev.total);
      } else if (ev.type === "checkpoint") {
        refresh();
      } else {
        setNote(ev.type === "done" ? "Training finished" : ev.type === "stopped" ? "Stopped, checkpoint saved" : `Failed: ${ev.message}`);
        source.close();
        refresh();
        if (ev.type === "done") onModelChanged();
      }
    };
    source.onerror = () => {
      source.close();
      refresh();
    };
  }, [refresh, onModelChanged]);

  useEffect(() => {
    if (running) connect();
    else if (shown != null) {
      api.firms.modelRun(shown).then(run => {
        setHistory(run.loss_history || []);
        setTotal(run.rounds_total);
      }).catch(() => undefined);
    }
  }, [running, shown]);
  useEffect(() => () => es.current?.close(), []);

  const act = fn => {
    setError(null);
    fn().then(() => {
      connect();
      refresh();
    }).catch(e => setError(e.message));
  };
  const first = runs?.runs?.[0];
  const resumable = first && ["stopped", "interrupted", "failed"].includes(first.status) && (first.last_checkpoint_round ?? 0) > 0 ? first : null;
  const last = history[history.length - 1];

  return (
    <>
      <div className="fc-train">
        <label className="field">
          <span>Rounds</span>
          <input className="select fc-rounds num" type="number" min={1} max={5000} value={rounds} disabled={running} onChange={e => setRounds(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <div className="fc-train-actions">
          <button className="btn-dark" type="button" disabled={running} onClick={() => act(() => api.firms.train(rounds, horizon))}>Train</button>
          <button className="btn" type="button" disabled={!running} onClick={() => api.firms.stopTraining().catch(e => setError(e.message))}>Stop</button>
          {resumable && <button className="btn" type="button" disabled={running} onClick={() => act(() => api.firms.resumeTraining(resumable.id))}>Resume {resumable.id}</button>}
        </div>
      </div>
      {(running || history.length > 0) && (
        <>
          <div className="fc-progress"><b style={{ width: `${((last?.round ?? 0) / (total || 1)) * 100}%` }} /></div>
          <div className="small num">
            {running ? "Training" : `Run ${shown}${shown === runs?.active ? ", in use" : ""}`}: round {last?.round ?? 0} of {total}
            {last?.val != null ? `, validation loss ${last.val.toFixed(4)}` : ""}
          </div>
          <LossChart points={history} />
        </>
      )}
      {note && <p className="small">{note}</p>}
      {error && <p className="notice">{error}</p>}
      {runs?.runs?.length > 0 && (
        <table className="tbl">
          <tbody>
            {runs.runs.slice(0, 6).map(r => (
              <tr key={r.id} className={r.id === runs.active ? "is-focus" : ""}>
                <th scope="row">Run {r.id}</th>
                <td className="quiet">{r.id === runs.active ? "in use" : r.status}</td>
                <td className="r num">{r.rounds_done}/{r.rounds_total}</td>
                <td className="r num">{r.metrics?.pr_auc != null ? r.metrics.pr_auc.toFixed(3) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default function ForecastPanel({ day, last, setDay, risk, forecast, opts, setOpts, onModelChanged, modelVersion }) {
  const [runs, setRuns] = useState(null);
  const refresh = useCallback(() => api.firms.modelRuns().then(setRuns).catch(() => undefined), []);
  useEffect(() => {
    refresh();
  }, [modelVersion]);
  const run = runs?.runs?.find(r => r.id === runs.active) || null;
  const state = dayState(day, last, run, addDays);
  const f = forecast.data;
  const rk = risk.data;
  const t = useMemo(() => tally(f), [f]);
  const realOn = day <= last;
  const rows = useMemo(() => {
    if (!rk) return [];
    return rk.countries
      .filter(c => !(opts.skipWar && WAR.has(c.name)))
      .map(c => ({ c, model: riskValue(c, opts.mode, "model") ?? 0, real: realOn ? riskValue(c, opts.mode, "real") : null }))
      .filter(x => x.model >= 0.15 || (x.real ?? 0) >= 0.15)
      .sort((a, b) => Math.max(b.model, b.real ?? 0) - Math.max(a.model, a.real ?? 0))
      .slice(0, 15);
  }, [rk, opts.mode, opts.skipWar, realOn]);
  const horizon = f?.horizon ?? rk?.horizon ?? run?.params?.horizon ?? 3;
  const set = patch => setOpts({ ...opts, ...patch });
  const missing = !forecast.loading && !forecast.error && f === null && runs && !runs.active;

  return (
    <div className="fc">
      <div className="fc-day">
        <span>
          {longDate(day)}
          {state && <span className={`fc-state fc-${state}`}>{STATE_LABEL[state]}</span>}
        </span>
        <button className="text-btn" type="button" onClick={() => setDay(last)} disabled={day === last}>Latest</button>
      </div>
      <div className="small">Next {horizon} days{f && f.feature_date !== day ? `, from data of ${shortDay(f.feature_date)}` : ""}{f && !f.complete && realOn ? ", outcome partly known" : ""}</div>

      <div className="controls">
        <div className="field">
          <span>Colour by</span>
          <Segmented options={[["own", "Own season"], ["compare", "Per area"]]} value={opts.mode} onChange={v => set({ mode: v })} full label="Colour countries by" />
        </div>
        <div className="toggles">
          <label className="check"><input type="checkbox" checked={opts.cells} onChange={e => set({ cells: e.target.checked })} /><i className="key key-cell" />Model cells</label>
          <label className="check"><input type="checkbox" checked={opts.real} onChange={e => set({ real: e.target.checked })} /><i className="key key-ring" />Confirmed fires</label>
          <label className="check"><input type="checkbox" checked={opts.alerts} onChange={e => set({ alerts: e.target.checked })} />Only alerts</label>
          <label className="check"><input type="checkbox" checked={opts.skipWar} onChange={e => set({ skipWar: e.target.checked })} />Leave out Ukraine and Russia</label>
        </div>
      </div>

      {forecast.error && <p className="notice">{forecast.error.message}</p>}
      {missing && <p className="notice">No trained model yet. Train one below.</p>}
      {forecast.loading && !f ? <Pending rows={2} /> : f && (
        <div className={`metrics${forecast.loading ? " busy" : ""}`}>
          <Metric value={num(t.hit)} label="Hits" />
          <Metric value={num(t.miss)} label="Misses" />
          <Metric value={f.complete ? num(t.falseAlarm) : "–"} label="False alarms" />
          <Metric value={num(t.alerts)} label={`Alerts ≥ ${Math.round(f.threshold * 100)}%`} />
        </div>
      )}

      <Section title="Countries" aside={opts.mode === "own" ? "against their own season" : "cells per 1,000 km²"}>
        {risk.loading && !rk ? <Pending rows={5} /> : (
          <table className={`tbl fc-countries${risk.loading ? " busy" : ""}`}>
            <thead>
              <tr><th /><th>Level</th><th className="r">Expected</th><th className="r">Real</th></tr>
            </thead>
            <tbody>
              {rows.map(({ c, model, real }) => (
                <tr key={c.name}>
                  <th scope="row">{c.name}</th>
                  <td><i className="key" style={{ background: riskColor(model) }} />{riskWord(model)}</td>
                  <td className="r num">{opts.mode === "compare" && c.density != null ? c.density.toFixed(2) : c.expected.toFixed(1)}</td>
                  <td className="r num">
                    {real === null || !c.real ? <span className="quiet">{realOn && rk.complete ? "0" : "not in yet"}</span> : (
                      <><i className="key" style={{ background: riskColor(real) }} />{opts.mode === "compare" && c.real.density != null ? c.real.density.toFixed(2) : num(c.real.expected)}</>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="quiet">Every country is at normal or low risk</td></tr>}
            </tbody>
          </table>
        )}
      </Section>

      <EventCheck run={run} onJump={setDay} />

      <Section title="Model" aside={run ? `run ${run.id}, trained to ${shortDay(run.metrics?.train_end || run.params.train_end)} ${String(run.params.train_end || "").slice(0, 4)}` : "not trained"}>
        {run?.metrics?.pr_auc != null && (
          <div className="metrics metrics-3 fc-model">
            <Metric value={run.metrics.pr_auc.toFixed(2)} label="PR-AUC" />
            <Metric value={`${Math.round((run.metrics.precision ?? 0) * 100)}%`} label="Precision" />
            <Metric value={`${Math.round((run.metrics.recall ?? 0) * 100)}%`} label="Recall" />
          </div>
        )}
        <Training runs={runs} refresh={refresh} horizon={horizon} onModelChanged={onModelChanged} />
      </Section>
    </div>
  );
}
