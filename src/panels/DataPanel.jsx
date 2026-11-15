import { useRef, useState } from "react";
import { api } from "../lib/api.js";
import { num } from "../lib/format.js";
import { Pending, Section } from "./Insights.jsx";

const STATUS_LABEL = { both: "Both sensors", modis_only: "MODIS only", viirs_only: "VIIRS only" };
const STATUS_COLOR = { both: "#c92a2a", modis_only: "#e8590c", viirs_only: "#1c7ed6" };
const PLATFORM_COLOR = { "MODIS Terra": "#f08c00", "MODIS Aqua": "#e8590c", "VIIRS SNPP": "#1c7ed6", "VIIRS NOAA-20": "#4dabf7", "VIIRS NOAA-21": "#a5d8ff" };
const LAYERS = [["modis", "MODIS", "#e8590c"], ["viirs", "VIIRS", "#1c7ed6"], ["common", "Confirmed", "#c92a2a"]];

function Split({ items, total, colors, labels = {} }) {
  return (
    <>
      <div className="split-bar">
        {items.map(([k, v]) => (
          <i key={k} style={{ width: `${(v / Math.max(total, 1)) * 100}%`, background: colors[k] || "#c5c8cd" }} />
        ))}
      </div>
      <table className="tbl">
        <tbody>
          {items.map(([k, v]) => (
            <tr key={k}>
              <th scope="row"><i className="key" style={{ background: colors[k] || "#c5c8cd" }} />{labels[k] || k}</th>
              <td className="r num">{num(v)}</td>
              <td className="r num quiet">{Math.round((v / Math.max(total, 1)) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Days({ days }) {
  const max = Math.max(...days.map(d => d.modis + d.viirs), 1);
  return (
    <div className="data-days">
      {days.map(d => (
        <span key={d.date} title={`${d.date}: MODIS ${d.modis}, VIIRS ${d.viirs}`}>
          <b className="v" style={{ height: `${(d.viirs / max) * 100}%` }} />
          <b className="m" style={{ height: `${(d.modis / max) * 100}%` }} />
        </span>
      ))}
    </div>
  );
}

export default function DataPanel({ summary, sources, pipeline, modelRuns, query, onImport, importing, importResult, importError, layers, setLayers }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const s = summary.data;
  const steps = (pipeline.data?.steps || []).filter(st => st.state !== "skipped");
  const files = sources.data?.sources || [];
  const runs = modelRuns?.data?.runs || [];
  const pick = list => list && list[0] && onImport(list[0]);
  const platform = prefix => (s ? Object.entries(s.by_platform).filter(([k]) => k.startsWith(prefix)).reduce((t, [, v]) => t + v, 0) : 0);

  return (
    <div className="data">
      <Section title="Map layers">
        <div className="toggles">
          {LAYERS.map(([k, label, c]) => (
            <label key={k} className="check">
              <input type="checkbox" checked={layers[k]} onChange={e => setLayers({ ...layers, [k]: e.target.checked })} />
              <i className="key" style={{ background: c }} />
              {label}
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={layers.incidents} onChange={e => setLayers({ ...layers, incidents: e.target.checked })} />
            <i className="key key-line" />
            Incidents
          </label>
        </div>
      </Section>

      {summary.error && <p className="notice">{summary.error.message}</p>}
      {!s && summary.loading && <Pending rows={4} />}
      {s && (
        <>
          <div className="metrics">
            <div className="metric"><span className="metric-v num">{num(s.total)}</span><span className="metric-l">Detections</span></div>
            <div className="metric"><span className="metric-v num">{num(s.confirmed)}</span><span className="metric-l">In incidents</span></div>
            <div className="metric"><span className="metric-v num">{num(s.mean_frp)}</span><span className="metric-l">Mean FRP, MW</span></div>
            <div className="metric"><span className="metric-v num">{num(s.max_frp)}</span><span className="metric-l">Peak FRP, MW</span></div>
          </div>
          {s.total > 0 && (
            <>
              <Section title="Cross-sensor match">
                <Split items={Object.entries(s.by_status).sort((a, b) => b[1] - a[1])} total={s.total} colors={STATUS_COLOR} labels={STATUS_LABEL} />
              </Section>
              <Section title="Satellite">
                <Split items={Object.entries(s.by_platform).sort((a, b) => b[1] - a[1])} total={s.total} colors={PLATFORM_COLOR} />
              </Section>
              <Section title="Per day">
                <Days days={s.days} />
              </Section>
            </>
          )}
          <Section title="Download CSV">
            <ul className="links">
              <li><a href={api.firms.exportUrl(query)} download>Harmonized detections</a><span className="num quiet">{num(s.total)}</span></li>
              <li><a href={api.firms.exportUrl(query, "MODIS")} download>MODIS only</a><span className="num quiet">{num(platform("MODIS"))}</span></li>
              <li><a href={api.firms.exportUrl(query, "VIIRS")} download>VIIRS only</a><span className="num quiet">{num(platform("VIIRS"))}</span></li>
            </ul>
          </Section>
        </>
      )}

      <Section title="Import FIRMS CSV">
        <div
          className={`dropzone${drag ? " over" : ""}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
          onClick={() => input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        >
          {importing ? "Importing" : "Drop a file or choose one"}
          <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={e => { pick(e.target.files); e.target.value = ""; }} />
        </div>
        {importError && <p className="notice">{importError}</p>}
        {importResult && (
          <table className="tbl import-result">
            <tbody>
              {importResult.files.map(f => (
                <tr key={f.file}>
                  <th scope="row">{f.source}</th>
                  <td className="quiet">{f.first} to {f.last}</td>
                  <td className="r num">{num(f.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Pipeline" aside={pipeline.data?.running ? "running" : s?.data?.detections ? `${num(s.data.detections)} stored` : null}>
        <table className="tbl">
          <tbody>
            {steps.map(st => (
              <tr key={st.step}>
                <th scope="row"><i className={`key state-${st.state}`} />{st.step}</th>
                <td className="quiet">{st.state === "up_to_date" ? "" : st.state}</td>
                <td className="r num">{st.last?.row_count != null ? num(st.last.row_count) : ""}</td>
              </tr>
            ))}
            {files.map(f => (
              <tr key={f.source}>
                <th scope="row" className="quiet">{f.source}</th>
                <td />
                <td className="r num quiet">{f.files} files</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Forecast model" aside={runs.length ? null : "not trained"}>
        {runs.length > 0 && (
          <table className="tbl">
            <tbody>
              {runs.slice(0, 4).map(run => (
                <tr key={run.id}>
                  <th scope="row">Run {run.id}</th>
                  <td className="quiet">{run.status}</td>
                  <td className="r num">{run.finished_at ? run.finished_at.slice(0, 10) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
