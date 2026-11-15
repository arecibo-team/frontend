import { useEffect, useMemo, useState } from "react";
import EuropeMap from "./components/EuropeMap.jsx";
import Segmented from "./components/Segmented.jsx";
import Sidebar, { Dialog } from "./components/Sidebar.jsx";
import Timeline from "./components/Timeline.jsx";
import { Logo, Search } from "./components/Header.jsx";
import Icon from "./components/Icon.jsx";
import AreaPanel from "./panels/AreaPanel.jsx";
import CoordsForm from "./panels/CoordsForm.jsx";
import FiresPanel from "./panels/FiresPanel.jsx";
import SimPanel from "./panels/SimPanel.jsx";
import DataPanel from "./panels/DataPanel.jsx";
import Busy, { useMinPending } from "./components/Busy.jsx";
import { ALERT_COLOR, HAZARD_NAME, STORIES, decodeShocks, encodeShocks, toRequest } from "./lib/sim.js";
import HelpPanel from "./panels/HelpPanel.jsx";
import { REGION_LABEL, WeightsPanel, contextMonth } from "./panels/Insights.jsx";
import MethodPage from "./panels/Method.jsx";
import { api } from "./lib/api.js";
import { DATA_TO, DEFAULT_DATE, REPLAY_FROM, addDays, clampDate, clampReplay, iso } from "./lib/dates.js";
import { MONTHS, dec, longDate } from "./lib/format.js";
import { AMBER_COLORS, AMBER_STEPS, COUNTRY_NAMES, POWER_COLORS, POWER_STEPS, classColor, fireRadius } from "./lib/geo.js";
import { BOUNDS, CENTROIDS, SCENARIOS, routesFor } from "./lib/plan.js";
import { useFetch } from "./lib/useFetch.js";

function readHash() {
  const query = window.location.hash.replace(/^#\/?[^?]*\??/, "");
  return Object.fromEntries(new URLSearchParams(query));
}

function useParams() {
  const [params, set] = useState(readHash);
  useEffect(() => {
    const on = () => set(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const update = patch => {
    const next = { ...readHash(), ...patch };
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== null && v !== ""));
    const hash = `#/?${new URLSearchParams(clean).toString()}`;
    window.history.replaceState(null, "", hash);
    set(clean);
  };
  return [params, update];
}

const DRY_STEPS = [-1.5, -0.5, 0.5, 1.5];
const DRY_COLORS = ["#2f62a8", "#9cbde0", "#efefea", "#f2b27c", "#c2410c"];
const NEUTRAL = "#e7eaef";
const REGION_STEPS = [20, 35, 50, 65];
const REGION_COLORS = ["#c2410c", "#f2a46b", "#ebe6dc", "#8faed4", "#244f80"];

function liveShocks(events) {
  const groups = {};
  (events || []).forEach(e => {
    if (!COUNTRY_NAMES[e.iso2] || !HAZARD_NAME[e.type]) return;
    const key = `${e.iso2}|${e.type}|${e.alert}`;
    groups[key] = (groups[key] || 0) + 1;
  });
  return Object.entries(groups)
    .map(([k, n]) => {
      const [iso2, type, alert] = k.split("|");
      return { iso2, type, alert, count: Math.min(10, n) };
    })
    .sort((a, b) => (b.alert === "Red") - (a.alert === "Red") || b.count - a.count)
    .slice(0, 12);
}

function MapLegend({ layer, help, title, bubbles = true, month }) {
  if (layer === "dryness") {
    return (
      <div className="map-legend floating">
        <div>
          <div className="legend-title">Dryness{month ? `, ${month}` : ""}</div>
          <div className="ramp">{DRY_COLORS.map(c => <span key={c} style={{ background: c }} />)}</div>
          <div className="ramp-ticks ramp-ends"><span>wetter</span><span>usual</span><span>drier</span></div>
        </div>
        <div className="small" style={{ maxWidth: 190 }}>Soil moisture deficit and land heat against 2001–2020, on a 1° grid</div>
      </div>
    );
  }
  if (help) {
    return (
      <div className="map-legend floating">
        <span className="legend-item"><i className="key-route" />Route, thicker is sooner</span>
        <span className="legend-item"><i className="key-sends" />Sends help</span>
        <span className="legend-item"><i className="key-left" />Left out</span>
      </div>
    );
  }
  const power = layer === "power" || layer === "regions";
  const steps = layer === "regions" ? [0, ...REGION_STEPS] : power ? [0, ...POWER_STEPS] : [0, ...AMBER_STEPS];
  const colors = layer === "regions" ? REGION_COLORS : power ? POWER_COLORS : AMBER_COLORS;
  return (
    <div className="map-legend floating">
      <div>
        <div className="legend-title">{title || (layer === "regions" ? "Power by region" : power ? "Power" : "Amber index")}</div>
        <div className="ramp">{colors.map(c => <span key={c} style={{ background: c }} />)}</div>
        <div className="ramp-ticks">{steps.map(s => <span key={s}>{s}</span>)}</div>
      </div>
      {bubbles && <div>
        <div className="legend-title">Hotspots, 24 h</div>
        <div className="bubbles">
          {[50, 500, 1200].map(v => (
            <span key={v}>
              <i style={{ width: fireRadius(v) * 2, height: fireRadius(v) * 2 }} />
              {v.toLocaleString("en-GB")}
            </span>
          ))}
        </div>
      </div>}
    </div>
  );
}

function CopyLink() {
  const [done, setDone] = useState(false);
  return (
    <button
      className="text-btn"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          window.prompt("Copy this link", window.location.href);
        }
      }}
    >
      <Icon name="link" />
      {done ? "Copied" : "Copy link"}
    </button>
  );
}

export default function App() {
  const [params, setParams] = useParams();
  const date = clampDate(params.date || DEFAULT_DATE);
  const replayDate = clampReplay(date);
  const layer = ["amber", "regions", "dryness"].includes(params.layer) ? params.layer : "power";
  const showFires = params.fires !== "0";
  const filter = ["above", "watch"].includes(params.filter) ? params.filter : "all";
  const left = params.left !== "0";
  const right = ["help", "sim", "data"].includes(params.right) ? params.right : params.right === "0" ? null : "area";
  const mode = params.mode === "raw" ? "raw" : "harmonized";
  const [drawing, setDrawing] = useState(false);
  const [dialog, setDialog] = useState(null);

  const boxArr = params.box ? params.box.split(",").map(Number) : null;
  const box = boxArr && boxArr.length === 4 && boxArr.every(Number.isFinite) && boxArr[0] < boxArr[2] && boxArr[1] < boxArr[3] ? boxArr : null;
  const iso2 = box ? null : params.c && COUNTRY_NAMES[params.c] ? params.c : "GR";
  const to0 = clampDate(params.to || date);
  const asof = to0 > date ? to0 : date;
  const to = to0;
  const from0 = clampDate(params.from || `${to.slice(0, 7)}-01`);
  const from = from0 > to ? to : from0;
  const query = { country: iso2, box: box ? box.join(",") : null, from, to, asof };

  const tlMode = params.tl === "all" ? "all" : "year";
  const tlYear = Number(params.ty) || Number(asof.slice(0, 4));
  const tlEnd = tlMode === "all" ? DATA_TO : iso(tlYear, 12, 31) > DATA_TO ? DATA_TO : iso(tlYear, 12, 31);
  const tlStart = tlMode === "all" ? "2001-01-01" : iso(tlYear, 1, 1);

  const replay = useFetch(() => api.replay(replayDate), [replayDate]);
  const area = useFetch(() => api.area(query), [iso2, query.box, from, to, asof]);
  const timeline = useFetch(() => api.area({ country: iso2, box: query.box, from: tlStart, to: tlEnd, asof: tlEnd }), [iso2, query.box, tlStart, tlEnd]);

  const helpInitial = {
    recipient: params.hc && COUNTRY_NAMES[params.hc] ? params.hc : iso2 || "GR",
    scenario: SCENARIOS.some(([id]) => id === params.s) ? params.s : "wildfire_season",
    floor: params.floor !== "0",
    skip: params.skip !== "0",
    fastest: params.fast !== "0"
  };
  const [form, setForm] = useState(helpInitial);
  useEffect(() => setForm(f => ({ ...f, recipient: helpInitial.recipient })), [helpInitial.recipient]);
  const helpKey = right === "help" ? JSON.stringify(helpInitial) + replayDate : null;
  const plan = useFetch(
    () =>
      helpKey
        ? api.plan({
            recipient: helpInitial.recipient,
            date: replayDate,
            scenario: helpInitial.scenario,
            min_power_after: helpInitial.floor ? 50 : null,
            skip_active_fires: helpInitial.skip,
            fastest_first: helpInitial.fastest
          })
        : Promise.resolve(null),
    [helpKey]
  );
  const runPlan = () =>
    setParams({
      hc: form.recipient,
      s: form.scenario === "wildfire_season" ? undefined : form.scenario,
      floor: form.floor ? undefined : "0",
      skip: form.skip ? undefined : "0",
      fast: form.fastest ? undefined : "0"
    });

  const [draft, setDraft] = useState(() => {
    const d = decodeShocks(params.sim);
    return d.length ? d : STORIES[0].shocks;
  });
  const [simNonce, setSimNonce] = useState(0);
  const simKey = right === "sim" && params.sim ? `${params.sim}|${replayDate}|${simNonce}` : null;
  const sim = useFetch(
    () => (simKey ? api.simulate(toRequest(decodeShocks(params.sim), replayDate)) : Promise.resolve(null)),
    [simKey]
  );
  const runSim = list => {
    setDraft(list);
    setSimNonce(n => n + 1);
    setParams({ sim: encodeShocks(list), view: undefined });
  };
  const simView = params.view === "before" ? "before" : "after";
  const busySim = useMinPending(Boolean(simKey) && sim.loading, 1100);
  const busyPlan = useMinPending(Boolean(helpKey) && plan.loading, 1100);

  const detectionsOn = params.det === "1";
  const [layers, setLayers] = useState({ modis: true, viirs: true, common: true, incidents: false });
  const [dataVersion, setDataVersion] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const firmsQ = { from, to, bounds: box || BOUNDS[iso2] };
  const dataOpen = right === "data";
  const summary = useFetch(() => (dataOpen ? api.firms.summary(firmsQ) : Promise.resolve(null)), [dataOpen, from, to, query.box, iso2, dataVersion]);
  const sources = useFetch(() => (dataOpen ? api.firms.sources() : Promise.resolve(null)), [dataOpen, dataVersion]);
  const [pipeTick, setPipeTick] = useState(0);
  const pipeline = useFetch(() => (dataOpen || importResult ? api.firms.pipeline() : Promise.resolve(null)), [dataOpen, pipeTick, dataVersion]);
  const pipeRunning = Boolean(pipeline.data?.running);
  useEffect(() => {
    if (!pipeRunning) return undefined;
    const t = setTimeout(() => setPipeTick(n => n + 1), 3000);
    return () => clearTimeout(t);
  }, [pipeRunning, pipeTick]);
  const [wasRunning, setWasRunning] = useState(false);
  useEffect(() => {
    if (pipeRunning) setWasRunning(true);
    else if (wasRunning) {
      setWasRunning(false);
      setDataVersion(v => v + 1);
    }
  }, [pipeRunning]);
  const mask = (layers.modis ? 1 : 0) | (layers.viirs ? 2 : 0) | (layers.common ? 4 : 0);
  const tileUrl = detectionsOn && mask ? api.firms.tileUrl(from, to, mask, dataVersion) : null;
  const incidentsOn = detectionsOn && layers.incidents;
  const incidentData = useFetch(() => (incidentsOn ? api.firms.incidents({ from, to }) : Promise.resolve(null)), [incidentsOn, from, to, dataVersion]);
  const runImport = async file => {
    setImporting(true);
    setImportError(null);
    try {
      const out = await api.firms.upload(file);
      setImportResult(out);
      setParams({ det: "1" });
      setPipeTick(n => n + 1);
    } catch (e) {
      setImportError(e.message);
    } finally {
      setImporting(false);
    }
  };
  const busyImport = useMinPending(importing, 1100);

  const ctxMonth = contextMonth(replayDate);
  const mapLayer = layer === "dryness" && !ctxMonth ? "power" : layer;
  const needRegions = mapLayer === "regions" || (right === "area" && !box);
  const regionsData = useFetch(() => (needRegions ? api.regions(replayDate) : Promise.resolve(null)), [needRegions, replayDate]);
  const [regionGeo, setRegionGeo] = useState(null);
  useEffect(() => {
    if (mapLayer === "regions" && !regionGeo) import("./data/eu-regions.json").then(m => setRegionGeo(m.default));
  }, [mapLayer]);
  const dryGrid = useFetch(() => (mapLayer === "dryness" ? api.context.grid("dryness", ctxMonth) : Promise.resolve(null)), [mapLayer, ctxMonth]);
  const live = useFetch(() => (right === "sim" ? api.live() : Promise.resolve(null)), [right === "sim"]);
  const liveStory = useMemo(() => liveShocks(live.data?.events), [live.data]);
  const modelRuns = useFetch(() => (dataOpen ? api.firms.modelRuns() : Promise.resolve(null)), [dataOpen]);

  const rd = replay.data;
  const byIso = useMemo(() => Object.fromEntries((rd?.countries || []).map(c => [c.iso2, c])), [rd]);
  const fires = rd?.fires || [];
  const selectedFire = fires.find(f => f.id === params.fire) || null;
  const calloutFire = selectedFire || (iso2 ? fires.filter(f => f.iso2 === iso2).sort((a, b) => b.ratio - a.ratio)[0] : null);
  const month = rd ? MONTHS[Number(rd.date.slice(5, 7)) - 1] : "";
  const country = iso2 && byIso[iso2] ? { ...byIso[iso2], ref: rd.reference_date } : null;

  const p = right === "help" ? plan.data : null;
  const s = right === "sim" && simKey ? sim.data : null;
  const simRows = s ? Object.fromEntries(s.rows.map(r => [r.iso2, r])) : null;
  const simShocks = s ? decodeShocks(params.sim) : [];
  const badges = [];
  const perCountry = {};
  simShocks.forEach(x => {
    const at = CENTROIDS[x.iso2];
    if (!at) return;
    const row = (perCountry[x.iso2] = (perCountry[x.iso2] || 0) + 1) - 1;
    badges.push({ key: `${x.iso2}-${row}`, lat: at[0], lon: at[1], row, color: ALERT_COLOR[x.alert], label: `${HAZARD_NAME[x.type]}${x.count > 1 ? ` ×${x.count}` : ""}` });
  });
  const donors = p ? Object.fromEntries(p.donors.map(d => [d.iso2, d])) : {};
  const fill = code => {
    if (simRows) {
      const r = simRows[code];
      if (!r) return "#dfe3e8";
      return classColor(simView === "before" ? r.power_before : r.power_after, POWER_STEPS, POWER_COLORS);
    }
    if (p) {
      if (donors[code]) return classColor(donors[code].power_before, POWER_STEPS, POWER_COLORS);
      if (code === p.recipient.iso2) return classColor(p.recipient.power_with_help, POWER_STEPS, POWER_COLORS);
      return "#e4e8ee";
    }
    if (mapLayer === "regions" || mapLayer === "dryness") return NEUTRAL;
    const c = byIso[code];
    if (!c) return "#dfe3e8";
    return mapLayer === "power" ? classColor(c.power, POWER_STEPS, POWER_COLORS) : classColor(c.amber, AMBER_STEPS, AMBER_COLORS);
  };

  const selectCountry = code => {
    setDrawing(false);
    setParams({ c: code, box: undefined, fire: undefined, right: right === "help" ? "help" : undefined, hc: right === "help" ? code : undefined });
  };
  const setBox = b => {
    setDrawing(false);
    setDialog(null);
    setParams({ box: b.join(","), c: undefined, fire: undefined, right: undefined, tab: params.tab || "calendar" });
  };
  const setDay = d => {
    const day = clampReplay(d);
    setParams({ date: day, fire: undefined, ty: undefined, to: params.to && params.to > day ? day : params.to });
  };

  useEffect(() => {
    const onKey = e => e.key === "Escape" && setDrawing(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const regionRows = useMemo(() => Object.fromEntries((regionsData.data?.regions || []).map(r => [`${r.iso2}-${r.region}`, r])), [regionsData.data]);
  const focusRegion = selectedFire?.region || (iso2 ? fires.filter(f => f.iso2 === iso2).sort((a, b) => b.detections - a.detections)[0]?.region : null);
  const regionShapes =
    mapLayer === "regions" && regionGeo && regionsData.data && !s && !p
      ? {
          key: `regions-${regionsData.data.date}`,
          data: regionGeo,
          style: f => {
            const r = regionRows[`${f.properties.iso2}-${f.properties.region}`];
            return {
              color: "#ffffff", weight: 1.2, fillOpacity: r?.available ? 0.92 : 0.4,
              fillColor: r?.available ? classColor(r.power, REGION_STEPS, REGION_COLORS) : "#dfe3e8"
            };
          },
          tooltip: f => {
            const r = regionRows[`${f.properties.iso2}-${f.properties.region}`];
            if (!r) return "";
            if (!r.available) return `<b>${REGION_LABEL[r.region]} ${r.name}</b><br>No regional estimate`;
            const fire = r.fire_share != null ? `${Math.round(r.fire_share * 100)}% of this month's fire` : "little fire this month";
            return `<b>${REGION_LABEL[r.region]} ${r.name}</b><br>${Math.round(r.firefighters).toLocaleString("en-GB")} firefighters, ${Math.round(r.share * 100)}% of the country<br>${fire}${r.active_fires ? `, ${r.active_fires} active` : ""}<br>Power <b>${Math.round(r.power)}</b>`;
          },
          onClick: props => selectCountry(props.iso2)
        }
      : null;
  const cells =
    mapLayer === "dryness" && dryGrid.data && !s && !p
      ? { key: `dry-${dryGrid.data.month}`, res: dryGrid.data.res_deg, data: dryGrid.data.cells, color: v => classColor(v, DRY_STEPS, DRY_COLORS), opacity: 0.8 }
      : null;

  const areaTitle = box ? "Custom area" : COUNTRY_NAMES[iso2];
  const areaSub = box
    ? `${box[1].toFixed(2)}–${box[3].toFixed(2)}°N, ${box[0].toFixed(2)}–${box[2].toFixed(2)}°E`
    : null;

  return (
    <div className="app ws">
      <header className="header">
        <a className="brand" href="#/">
          <Logo />
          Arecibo
        </a>
        <div className="day-picker">
          <button className="icon-btn" type="button" aria-label="Previous day" onClick={() => setDay(addDays(replayDate, -1))} disabled={replayDate <= REPLAY_FROM}>‹</button>
          <input type="date" className="date" min={REPLAY_FROM} max={DATA_TO} value={replayDate} aria-label="Replay day"
            onChange={e => e.target.value && setDay(e.target.value)} />
          <button className="icon-btn" type="button" aria-label="Next day" onClick={() => setDay(addDays(replayDate, 1))} disabled={replayDate >= DATA_TO}>›</button>
        </div>
        <div className="header-right">
          <nav className="panel-nav" aria-label="Panels">
            <button className={left ? "on" : ""} type="button" aria-pressed={left} onClick={() => setParams({ left: left ? "0" : undefined })}>
              <Icon name="flame" />
              Fires
              {rd && <span className="count">{rd.counts.all}</span>}
            </button>
            <button className={right === "area" ? "on" : ""} type="button" aria-pressed={right === "area"} onClick={() => setParams({ right: right === "area" ? "0" : undefined })}>
              <Icon name="area" />
              {areaTitle}
            </button>
            <button className={right === "sim" ? "on" : ""} type="button" aria-pressed={right === "sim"} onClick={() => setParams({ right: right === "sim" ? undefined : "sim" })}>
              <Icon name="pulse" />
              Simulate
            </button>
            <button className={right === "help" ? "on" : ""} type="button" aria-pressed={right === "help"} onClick={() => setParams({ right: right === "help" ? undefined : "help" })}>
              <Icon name="help" />
              Who can help
            </button>
            <button className={right === "data" ? "on" : ""} type="button" aria-pressed={right === "data"} onClick={() => setParams({ right: right === "data" ? undefined : "data" })}>
              <Icon name="data" />
              Data
            </button>
          </nav>
          <button className="text-btn" type="button" onClick={() => setDialog("method")}>
            <Icon name="book" />
            Method
          </button>
          <CopyLink />
          <Search onPick={selectCountry} />
        </div>
      </header>

      <div className="ws-body">
        {left && (
          <Sidebar side="left" title="Active fires" sub={rd ? `${rd.counts.all} in the EU on ${longDate(rd.date)}` : null} onClose={() => setParams({ left: "0" })}>
            {() => (
              <FiresPanel
                data={rd}
                filter={filter}
                onFilter={f => setParams({ filter: f === "all" ? undefined : f })}
                selectedId={selectedFire?.id}
                selectedFire={selectedFire}
                onPick={f => setParams({ c: f.iso2, box: undefined, fire: f.id, right: right === "help" ? "help" : undefined })}
              />
            )}
          </Sidebar>
        )}

        <div className="stage">
          <div className="map-toolbar">
            {s ? (
              <Segmented options={[["before", "Before"], ["after", "After"]]} value={simView} onChange={v => setParams({ view: v === "after" ? undefined : v })} label="Simulation view" />
            ) : right !== "help" ? (
              <Segmented
                options={[
                  ["power", "Power"],
                  ["amber", "Amber"],
                  ["regions", "Regions"],
                  ["dryness", "Dryness", !ctxMonth, ctxMonth ? "Soil moisture and land heat anomalies" : "Dryness data covers Jan 2024 to Oct 2026"]
                ]}
                value={mapLayer}
                onChange={v => setParams({ layer: v === "power" ? undefined : v })}
                label="Map layer"
              />
            ) : null}
            {!s && !p && (
              <label className="check check-ink">
                <input type="checkbox" checked={showFires} onChange={e => setParams({ fires: e.target.checked ? undefined : "0" })} />
                Fires
              </label>
            )}
            <button className={`tool${detectionsOn ? " on-soft" : ""}`} type="button" aria-pressed={detectionsOn} aria-label="Detections" title="MODIS and VIIRS detections" onClick={() => setParams({ det: detectionsOn ? undefined : "1" })}>
              <Icon name="layers" />
              <span className="tool-label">Detections</span>
            </button>
            <span className="tool-sep" />
            <button className={`tool${drawing ? " on" : ""}`} type="button" aria-pressed={drawing} aria-label={drawing ? "Cancel" : "Draw area"} title="Draw an area on the map" onClick={() => setDrawing(d => !d)}>
              <Icon name="draw" />
              <span className="tool-label">{drawing ? "Cancel" : "Draw area"}</span>
            </button>
            <button className="tool" type="button" aria-label="Coordinates" title="Enter coordinates" onClick={() => setDialog("coords")}>
              <Icon name="target" />
              <span className="tool-label">Coordinates</span>
            </button>
          </div>
          {replay.error && <p className="notice floating-notice">Could not load {longDate(replayDate)}: {replay.error.message}</p>}
          <EuropeMap
            fill={fill}
            selected={s ? null : p ? p.recipient.iso2 : iso2}
            outline={s ? [...new Set(simShocks.map(x => x.iso2))] : p ? p.donors.map(d => d.iso2) : []}
            badges={badges}
            regionShapes={regionShapes}
            cells={cells}
            tiles={tileUrl}
            incidents={incidentsOn && incidentData.data ? { key: `${from}-${to}-${dataVersion}-${incidentData.data.features.length}`, data: incidentData.data } : null}
            hatch={p ? p.left_out.map(l => l.iso2) : []}
            routes={p ? routesFor(p) : []}
            incident={p ? p.incident : null}
            onSelect={drawing ? undefined : selectCountry}
            fires={showFires && !p && !s ? fires : []}
            callout={showFires && !p && !s && calloutFire ? { lat: calloutFire.lat, lon: calloutFire.lon, title: calloutFire.name, sub: `${dec(calloutFire.ratio, 1)}× the ${month} median` } : null}
            flyTo={selectedFire ? [selectedFire.lat, selectedFire.lon] : null}
            focus={p ? [p.incident, ...p.donors.map(d => d.departure || CENTROIDS[d.iso2]).filter(Boolean)] : box ? [[box[1], box[0]], [box[3], box[2]]] : null}
            flyOnSelect
            drawing={drawing}
            onDraw={setBox}
            box={box}
            ariaLabel="Map of the EU"
          />
          <MapLegend layer={s ? "power" : mapLayer} help={Boolean(p)} title={s ? `Power, ${simView}` : null} bubbles={showFires && !s && mapLayer !== "dryness"} month={dryGrid.data?.month ? new Date(`${dryGrid.data.month}-01`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : null} />
        </div>

        {right === "area" && (
          <Sidebar side="right" title={areaTitle} sub={areaSub} onClose={() => setParams({ right: "0" })} width={400}>
            {wide => (
              <AreaPanel
                data={area.data}
                error={area.error}
                loading={area.loading}
                country={country}
                wide={wide}
                tab={params.tab}
                mode={mode}
                from={from}
                to={to}
                asof={asof}
                query={query}
                setParams={setParams}
                onHelp={() => setParams({ right: "help", hc: iso2 })}
                regions={regionsData}
                focusRegion={focusRegion}
                box={box}
                onWeights={() => setDialog("weights")}
              />
            )}
          </Sidebar>
        )}
        {right === "sim" && (
          <Sidebar side="right" title="Simulate" sub={`Starting from ${longDate(replayDate)}`} onClose={() => setParams({ right: undefined })} width={400}>
            {wide => (
              <SimPanel
                draft={draft}
                setDraft={setDraft}
                onRun={runSim}
                result={s}
                error={sim.error}
                loading={sim.loading}
                wide={wide}
                onHelp={code => setParams({ right: "help", hc: code })}
                liveStory={liveStory}
                liveLoading={live.loading}
              />
            )}
          </Sidebar>
        )}
        {right === "data" && (
          <Sidebar side="right" title="Data" sub="NASA FIRMS, MODIS and VIIRS" onClose={() => setParams({ right: undefined })} width={400}>
            {() => (
              <DataPanel
                summary={summary}
                sources={sources}
                pipeline={pipeline}
                query={firmsQ}
                areaLabel={areaTitle}
                rangeLabel={`${longDate(from)} to ${longDate(to)}`}
                onImport={runImport}
                importing={importing}
                importResult={importResult}
                importError={importError}
                modelRuns={modelRuns}
                layers={layers}
                setLayers={l => {
                  setLayers(l);
                  if (!detectionsOn) setParams({ det: "1" });
                }}
              />
            )}
          </Sidebar>
        )}
        {right === "help" && (
          <Sidebar side="right" title="Who can help" onClose={() => setParams({ right: undefined })} width={360}>
            {wide => <HelpPanel form={form} setForm={setForm} onRun={runPlan} plan={plan.data} error={plan.error} loading={plan.loading} wide={wide} />}
          </Sidebar>
        )}
      </div>

      <Timeline
        series={timeline.data?.series}
        loading={timeline.loading}
        from={from}
        to={to}
        day={replayDate}
        mode={tlMode}
        year={tlYear}
        label={`${areaTitle}, fire cell-days`}
        onMode={m => setParams({ tl: m === "year" ? undefined : m })}
        onYear={y => setParams({ ty: String(y) })}
        onRange={(a, b) => setParams({ from: a, to: b, right: right === "help" ? "help" : undefined, tab: "range" })}
        onDay={setDay}
      />

      <Busy show={busySim} title="Running the simulation" steps={["Adding the hazards to each country", "Recomputing the Amber index", "Committing crews and power", "Ranking the EU"]} />
      <Busy show={busyImport} title="Importing FIRMS data" steps={["Reading the CSV", "Sorting rows by satellite and product", "Starting the harmonization pipeline"]} />
      <Busy show={busyPlan && !busySim} title="Planning assistance" steps={["Checking who has power to spare", "Solving the assignment", "Timing the routes"]} />

      {dialog === "weights" && (
        <Dialog title="Weigh the Amber index yourself" onClose={() => setDialog(null)}>
          <WeightsPanel iso2={iso2} />
        </Dialog>
      )}
      {dialog === "method" && (
        <Dialog title="Method" onClose={() => setDialog(null)}>
          <MethodPage />
        </Dialog>
      )}
      {dialog === "coords" && (
        <Dialog title="Area by coordinates" onClose={() => setDialog(null)} wide={false}>
          <CoordsForm box={box} onBox={setBox} />
        </Dialog>
      )}
    </div>
  );
}
