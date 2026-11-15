import { useRef, useState } from "react";
import { api } from "../lib/api.js";
import { longDate, num } from "../lib/format.js";

const STATUS_LABEL = { both: "Seen by both", modis_only: "MODIS only", viirs_only: "VIIRS only" };
const STEP_LABEL = { done: "Done", pending: "Pending", running: "Running", failed: "Failed", skipped: "Skipped" };

function Split({ items, total, colors }) {
  return (
    <div className="split">
      <div className="split-bar">
        {items.map(([k, v]) => (
          <i key={k} style={{ width: `${(v / Math.max(total, 1)) * 100}%`, background: colors[k] || "#c5c8cd" }} title={`${k}: ${num(v)}`} />
        ))}
      </div>
      <ul className="split-legend">
        {items.map(([k, v]) => (
          <li key={k}>
            <i style={{ background: colors[k] || "#c5c8cd" }} />
            <span>{STATUS_LABEL[k] || k}</span>
            <b className="mono">{num(v)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Days({ days }) {
  if (!days.length) return null;
  const max = Math.max(...days.map(d => d.modis + d.viirs), 1);
  return (
    <div className="data-days" title="Detections per day, MODIS below VIIRS">
      {days.map(d => (
        <span key={d.date} title={`${d.date}: MODIS ${d.modis}, VIIRS ${d.viirs}, both ${d.both}`}>
          <b className="v" style={{ height: `${(d.viirs / max) * 100}%` }} />
          <b className="m" style={{ height: `${(d.modis / max) * 100}%` }} />
        </span>
      ))}
    </div>
  );
}

export default function DataPanel({ summary, sources, pipeline, modelRuns, query, rangeLabel, areaLabel, onImport, importing, importResult, importError, layers, setLayers }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const s = summary.data;
  const coverage = s?.data;
  const steps = pipeline.data?.steps || [];
  const files = sources.data?.sources || [];
  const pick = list => list && list[0] && onImport(list[0]);

  return (
    <div className="data">
      <section className="block">
        <h3 className="h3">Harmonized MODIS and VIIRS detections</h3>
        {coverage?.detections ? (
          <p className="small">
            {num(coverage.detections)} detections from {longDate(coverage.first)} to {longDate(coverage.last)}, each checked
            for a match across sensors within 1 km and 3 hours
          </p>
        ) : (
          <p className="small">No detections loaded yet. Import a FIRMS CSV below, or seed the server.</p>
        )}
        <div className="layer-toggles">
          {[["modis", "MODIS", "#e8590c"], ["viirs", "VIIRS", "#1c7ed6"], ["common", "Confirmed", "#c92a2a"]].map(([k, label, c]) => (
            <label key={k} className="check">
              <input type="checkbox" checked={layers[k]} onChange={e => setLayers({ ...layers, [k]: e.target.checked })} />
              <i className="swatch" style={{ background: c }} />
              {label}
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={layers.incidents} onChange={e => setLayers({ ...layers, incidents: e.target.checked })} />
            <i className="swatch swatch-line" />
            Incidents
          </label>
        </div>
      </section>

      <section className="block">
        <h3 className="h3">{areaLabel}, {rangeLabel}</h3>
        {summary.error && <p className="notice">{summary.error.message}</p>}
        {s && (
          <>
            <div className="kpis">
              <div>
                <div className="label">Detections</div>
                <div className="big">{num(s.total)}</div>
              </div>
              <div>
                <div className="label">Inside incidents</div>
                <div className="big">{num(s.confirmed)}</div>
              </div>
              <div>
                <div className="label">Mean FRP</div>
                <div className="big">{num(s.mean_frp)}<small> MW</small></div>
              </div>
              <div>
                <div className="label">Peak FRP</div>
                <div className="big">{num(s.max_frp)}<small> MW</small></div>
              </div>
            </div>
            {s.total > 0 && (
              <>
                <h3 className="h3">Cross-sensor match</h3>
                <Split items={Object.entries(s.by_status).sort((a, b) => b[1] - a[1])} total={s.total}
                  colors={{ both: "#c92a2a", modis_only: "#e8590c", viirs_only: "#1c7ed6" }} />
                <h3 className="h3">By satellite</h3>
                <Split items={Object.entries(s.by_platform).sort((a, b) => b[1] - a[1])} total={s.total}
                  colors={{ "MODIS Terra": "#f08c00", "MODIS Aqua": "#e8590c", "VIIRS SNPP": "#1c7ed6", "VIIRS NOAA-20": "#4dabf7", "VIIRS NOAA-21": "#a5d8ff" }} />
                <h3 className="h3">Per day</h3>
                <Days days={s.days} />
              </>
            )}
          </>
        )}
      </section>

      <section className="block">
        <h3 className="h3">Export</h3>
        <div className="download-row">
          <a className="download" href={api.firms.exportUrl(query)} download>
            <b>Harmonized detections</b>
            <span>{s ? `${num(s.total)} rows, both sensors` : "CSV"}</span>
          </a>
          <a className="download" href={api.firms.exportUrl(query, "MODIS")} download>
            <b>MODIS only</b>
            <span>{s ? `${num(Object.entries(s.by_platform).filter(([k]) => k.startsWith("MODIS")).reduce((t, [, v]) => t + v, 0))} rows` : "CSV"}</span>
          </a>
          <a className="download" href={api.firms.exportUrl(query, "VIIRS")} download>
            <b>VIIRS only</b>
            <span>{s ? `${num(Object.entries(s.by_platform).filter(([k]) => k.startsWith("VIIRS")).reduce((t, [, v]) => t + v, 0))} rows` : "CSV"}</span>
          </a>
        </div>
      </section>

      <section className="block">
        <h3 className="h3">Import FIRMS data</h3>
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
          <b>{importing ? "Importing…" : "Drop a FIRMS CSV here"}</b>
          <span>MODIS or VIIRS, from the FIRMS API, archive download or country files</span>
          <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={e => { pick(e.target.files); e.target.value = ""; }} />
        </div>
        {importError && <p className="notice">{importError}</p>}
        {importResult && (
          <ul className="import-result">
            {importResult.files.map(f => (
              <li key={f.file}>
                <span>{f.source}</span>
                <b className="mono">{num(f.rows)}</b>
                <span className="small">{f.first} to {f.last}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h3 className="h3">Forecast model</h3>
        {modelRuns?.data?.runs?.length ? (
          <ul className="steps">
            {modelRuns.data.runs.slice(0, 4).map(run => (
              <li key={run.id} className={`step-${run.status === "done" ? "done" : run.status === "running" ? "running" : "failed"}`}>
                <i />
                <span>Run {run.id}</span>
                <span className="small">{run.status}</span>
                <b className="mono">{run.finished_at ? run.finished_at.slice(0, 10) : ""}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small">
            The LightGBM fire forecast and the country risk model are not trained in this deployment. They need the weather step,
            then <span className="mono">POST /api/model/train</span>. Their APIs are listed in apis/README.md.
          </p>
        )}
      </section>

      <section className="block">
        <h3 className="h3">Pipeline{pipeline.data?.running ? ", running" : ""}</h3>
        <ul className="steps">
          {steps.map(st => (
            <li key={st.step} className={`step-${st.state}`}>
              <i />
              <span>{st.step}</span>
              <span className="small">{st.reason || STEP_LABEL[st.state] || st.state}</span>
              <b className="mono">{st.last?.row_count != null ? num(st.last.row_count) : ""}</b>
            </li>
          ))}
        </ul>
        {files.length > 0 && (
          <p className="small" style={{ marginTop: 8 }}>
            Raw files: {files.map(f => `${f.source} ${f.files}`).join(", ")}
          </p>
        )}
      </section>
    </div>
  );
}
