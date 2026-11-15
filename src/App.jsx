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
import ForecastPanel from "./panels/ForecastPanel.jsx";
import { FORECAST_FROM, FUTURE_DAYS, WAR, riskByIso, riskGradient, riskColor, riskValue } from "./lib/forecast.js";
import Busy, { useMinPending } from "./components/Busy.jsx";
import { ALERT_COLOR, HAZARD_NAME, STORIES, decodeShocks, encodeShocks, toRequest } from "./lib/sim.js";
import HelpPanel from "./panels/HelpPanel.jsx";
import { REGION_LABEL, WeightsPanel, contextMonth } from "./panels/Insights.jsx";
import MethodPage from "./panels/Method.jsx";
import { api } from "./lib/api.js";
import { DATA_TO, DEFAULT_DATE, REPLAY_FROM, addDays, clampDate, clampReplay, iso } from "./lib/dates.js";
import { MONTHS, dec, longDate } from "./lib/format.js";
import { ALL_NAMES, AMBER_COLORS, AMBER_STEPS, COUNTRY_NAMES, NEIGHBOUR_NAMES, POWER_COLORS, POWER_STEPS, classColor, fireRadius } from "./lib/geo.js";
import { BOUNDS, CENTROIDS } from "./lib/plan.js";
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
const NEIGHBOUR_CODES = Object.keys(NEIGHBOUR_NAMES);
const NEUTRAL = "#e7eaef";
const SCALE_STOPS = [0, 20, 35, 50, 65, 100];
const SCALE_COLORS = ["#b53a0a", "#e8834a", "#f1dcc4", "#bcd0e6", "#5f8cc0", "#1f456f"].map(h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)));

function powerColor(v) {
  const x = Math.max(0, Math.min(100, v));
  let i = 0;
  while (i < SCALE_STOPS.length - 2 && x > SCALE_STOPS[i + 1]) i++;
  const t = (x - SCALE_STOPS[i]) / (SCALE_STOPS[i + 1] - SCALE_STOPS[i]);
  const c = SCALE_COLORS[i].map((a, k) => Math.round(a + (SCALE_COLORS[i + 1][k] - a) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
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

function MapLegend({ layer, help, title, bubbles = true, month, risk }) {
  if (risk) {
    return (
      <div className="map-legend floating">
        <div>
          <div className="legend-title">{risk.mode === "own" ? "Country risk, own season" : "Fire cells per 1,000 km²"}</div>
          <div className="ramp ramp-smooth" style={{ background: riskGradient }} />
          <div className="ramp-ticks ramp-ends">{risk.mode === "own" ? <><span>low</span><span>very high</span></> : <><span>0.01</span><span>0.1</span><span>1</span></>}</div>
        </div>
        <span className="legend-item"><i className="key key-cell" />Model cell, solid over the alert level</span>
        <span className="legend-item"><i className="key key-ring" />Confirmed fire</span>
      </div>
    );
  }
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
        <div>
          <div className="legend-title">Power</div>
          <div className="ramp ramp-smooth" style={{ background: `linear-gradient(90deg, ${[0, 20, 35, 50, 65, 100].map(v => `${powerColor(v)} ${v}%`).join(", ")})` }} />
          <div className="ramp-ticks ramp-ends"><span>0</span><span>50</span><span>100</span></div>
        </div>
        <span className="legend-item"><i className="key-flow" />From abroad</span>
        <span className="legend-item"><i className="key-flow national" />Within the country</span>
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
      {layer !== "regions" && <span className="legend-item"><i className="key-hatch" />Fire record only</span>}
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
  const right = ["help", "sim", "data", "fc"].includes(params.right) ? params.right : params.right === "0" ? null : "area";
  const mode = params.mode === "raw" ? "raw" : "harmonized";
  const [drawing, setDrawing] = useState(false);
  const [dialog, setDialog] = useState(null);

  const boxArr = params.box ? params.box.split(",").map(Number) : null;
  const box = boxArr && boxArr.length === 4 && boxArr.every(Number.isFinite) && boxArr[0] < boxArr[2] && boxArr[1] < boxArr[3] ? boxArr : null;
  const iso2 = box ? null : params.c && ALL_NAMES[params.c] ? params.c : "GR";
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

  const firesFrom = params.from && params.to && from < replayDate ? from : null;
  const replay = useFetch(() => api.replay(replayDate, firesFrom), [replayDate, firesFrom]);
  const area = useFetch(() => api.area(query), [iso2, query.box, from, to, asof]);
  const timeline = useFetch(() => api.area({ country: iso2, box: query.box, from: tlStart, to: tlEnd, asof: tlEnd }), [iso2, query.box, tlStart, tlEnd]);

  const helpInitial = {
    recipient: params.hc && COUNTRY_NAMES[params.hc] ? params.hc : COUNTRY_NAMES[iso2] ? iso2 : "GR",
    load: [1, 1.5, 2].includes(Number(params.load)) ? Number(params.load) : 1,
    half: params.half !== "0",
    floor: params.floor === "1",
    fastest: params.fast !== "0"
  };
  const [form, setForm] = useState(helpInitial);
  useEffect(() => setForm(f => ({ ...f, recipient: helpInitial.recipient })), [helpInitial.recipient]);
  const [planNonce, setPlanNonce] = useState(0);
  const helpKey = right === "help" ? `${JSON.stringify(helpInitial)}|${replayDate}|${planNonce}` : null;
  const plan = useFetch(
    () =>
      helpKey
        ? api.plan({
            recipient: helpInitial.recipient,
            date: replayDate,
            load: helpInitial.load,
            keep_half: helpInitial.half,
            min_power_after: helpInitial.floor ? 50 : null,
            fastest_first: helpInitial.fastest
          })
        : Promise.resolve(null),
    [helpKey]
  );
  const runPlan = () => {
    setPlanNonce(n => n + 1);
    setParams({
      hc: form.recipient,
      load: form.load === 1 ? undefined : String(form.load),
      half: form.half ? undefined : "0",
      floor: form.floor ? "1" : undefined,
      fast: form.fastest ? undefined : "0"
    });
  };
  const [phase, setPhase] = useState("after");
  const [flowRun, setFlowRun] = useState(0);
  const playPlan = () => {
    setPhase("before");
    setFlowRun(n => n + 1);
  };
  useEffect(() => {
    if (plan.data && right === "help") playPlan();
  }, [plan.data, right]);
  useEffect(() => {
    if (phase !== "before") return undefined;
    const t = setTimeout(() => setPhase("after"), 1600);
    return () => clearTimeout(t);
  }, [phase, flowRun]);

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
  const [layers, setLayers] = useState({ modis: true, viirs: true, common: true, incidents: false, soil: false, soilCls: null });
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

  const fcOpen = right === "fc";
  const [fcOpts, setFcOpts] = useState({ mode: "own", cells: true, real: true, alerts: false, skipWar: false });
  const [modelVersion, setModelVersion] = useState(0);
  const fcView = ["real", "split"].includes(params.fv) ? params.fv : "model";
  const meta = useFetch(() => (fcOpen ? api.firms.meta() : Promise.resolve(null)), [fcOpen]);
  const fcLast = useMemo(() => (meta.data?.days ? Object.keys(meta.data.days).sort().pop() : null) || "2026-11-15", [meta.data]);
  const fcMax = addDays(fcLast, FUTURE_DAYS);
  const fd = !params.fd ? fcLast : params.fd < FORECAST_FROM ? FORECAST_FROM : params.fd > fcMax ? fcMax : params.fd;
  const fcReady = fcOpen && (Boolean(params.fd) || !meta.loading);
  const risk = useFetch(() => (fcReady ? api.firms.risk(fd) : Promise.resolve(null)), [fcReady, fd, modelVersion]);
  const forecast = useFetch(() => (fcReady ? api.firms.forecast(fd) : Promise.resolve(null)), [fcReady, fd, modelVersion]);
  const riskIso = useMemo(() => riskByIso(risk.data), [risk.data]);
  const fcData = forecast.data && forecast.data.date === fd ? forecast.data : null;
  const fcHorizon = fcData?.horizon ?? risk.data?.horizon ?? 3;
  const realFrom = addDays(fd, 1);
  const realTo = addDays(fd, fcHorizon) > fcLast ? fcLast : addDays(fd, fcHorizon);
  const realTiles = fcOpen && realFrom <= fcLast ? api.firms.tileUrl(realFrom, realTo, 4, meta.data?.generated_utc || "0") : null;
  const riskFill = source => code => {
    const c = riskIso[code];
    if (!c || (fcOpts.skipWar && WAR.has(c.name))) return "#dfe3e8";
    const v = riskValue(c, fcOpts.mode, source);
    return v == null ? "#dfe3e8" : riskColor(v);
  };
  const fcLayer = (model, real) => (fcData ? { data: fcData, model: model && fcOpts.cells, real: real && fcOpts.real, alerts: fcOpts.alerts } : null);

  const ctxMonth = contextMonth(replayDate);
  const mapLayer = layer === "dryness" && !ctxMonth ? "power" : layer;
  const needRegions = mapLayer === "regions" || (right === "area" && !box);
  const regionsData = useFetch(() => (needRegions ? api.regions(replayDate) : Promise.resolve(null)), [needRegions, replayDate]);
  const [regionGeo, setRegionGeo] = useState(null);
  useEffect(() => {
    if ((mapLayer === "regions" || right === "help") && !regionGeo) import("./data/eu-regions.json").then(m => setRegionGeo(m.default));
  }, [mapLayer, right]);
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
  const after = phase === "after";
  const fill = code => {
    if (fcOpen) return riskFill(fcView === "real" ? "real" : "model")(code);
    if (simRows) {
      const r = simRows[code];
      if (!r) return "#dfe3e8";
      return classColor(simView === "before" ? r.power_before : r.power_after, POWER_STEPS, POWER_COLORS);
    }
    if (p) {
      if (code === p.recipient) return NEUTRAL;
      const pw = p.powers[code];
      return pw ? powerColor(pw[after ? 1 : 0]) : "#dfe3e8";
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
    const inside = params.from && params.to && day >= params.from && day <= params.to;
    setParams({ date: day, fire: undefined, ty: undefined, from: inside ? params.from : undefined, to: inside ? params.to : undefined });
  };
  const setRange = (a, b, extra = {}) => {
    const lo = clampDate(a <= b ? a : b);
    const hi = clampDate(a <= b ? b : a);
    const day = replayDate >= lo && replayDate <= hi ? replayDate : clampReplay(hi);
    setParams({ from: lo, to: hi, date: day, ty: undefined, fire: day === replayDate ? params.fire : undefined, ...extra });
  };

  const setFd = d => setParams({ fd: d < FORECAST_FROM ? FORECAST_FROM : d > fcMax ? fcMax : d });
  const pickerDay = fcOpen ? fd : replayDate;
  const pickerMin = fcOpen ? FORECAST_FROM : REPLAY_FROM;
  const pickerMax = fcOpen ? fcMax : DATA_TO;
  const pickDay = fcOpen ? setFd : setDay;

  useEffect(() => {
    const onKey = e => e.key === "Escape" && setDrawing(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const regionRows = useMemo(() => Object.fromEntries((regionsData.data?.regions || []).map(r => [`${r.iso2}-${r.region}`, r])), [regionsData.data]);
  const focusRegion = selectedFire?.region || (iso2 ? fires.filter(f => f.iso2 === iso2).sort((a, b) => b.detections - a.detections)[0]?.region : null);
  const planRegions = useMemo(() => (p ? Object.fromEntries(p.regions.map(g => [g.region, g])) : {}), [p]);
  const planShapes = useMemo(
    () => (p && regionGeo ? { type: "FeatureCollection", features: regionGeo.features.filter(f => f.properties.iso2 === p.recipient) } : null),
    [p?.recipient, regionGeo]
  );
  const helpShapes =
    p && planShapes
      ? {
          key: `plan-${p.recipient}`,
          restyle: `${phase}-${flowRun}`,
          data: planShapes,
          style: f => {
            const g = planRegions[f.properties.region];
            return { color: "#ffffff", weight: 1.2, fillOpacity: 0.95, fillColor: g ? powerColor(after ? g.power_after : g.power_before) : NEUTRAL };
          },
          tooltip: f => {
            const g = planRegions[f.properties.region];
            if (!g) return "";
            return `<b>${REGION_LABEL[g.region]} ${p.name}</b><br>Fires need ${g.need.toLocaleString("en-GB")}, local crews ${g.local.toLocaleString("en-GB")}<br>Power ${Math.round(g.power_before)} before, ${Math.round(g.power_after)} after`;
          }
        }
      : null;
  const flows = p && after
    ? p.moves.map((m, i) => ({ key: `${flowRun}-${i}`, from: m.from_point, to: m.to_point, kind: m.kind, n: m.firefighters, order: i }))
    : [];
  const planBadges = p
    ? [
        ...p.regions.filter(g => g.need > 0).map(g => ({ key: `need-${g.region}`, lat: g.front[0], lon: g.front[1], row: 0, color: after && !g.uncovered ? "#2f7d4f" : "#c2410c", label: after && !g.uncovered ? `${g.need.toLocaleString("en-GB")} covered` : `needs ${g.need.toLocaleString("en-GB")}` })),
        ...(after ? p.donors.map(d => ({ key: `sent-${d.iso2}`, lat: d.departure[0], lon: d.departure[1], row: 0, color: "#18181b", label: `${d.name} ${d.sent.toLocaleString("en-GB")}` })) : [])
      ]
    : [];
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

  const areaTitle = box ? "Custom area" : ALL_NAMES[iso2];
  const areaSub = box
    ? `${box[1].toFixed(2)}–${box[3].toFixed(2)}°N, ${box[0].toFixed(2)}–${box[2].toFixed(2)}°E`
    : null;

  return (
    <div className="app ws">
      <header className="header">
        <a className="brand" href="#/">
          <Logo />
        </a>
        <div className="day-picker">
          <button className="icon-btn" type="button" aria-label="Previous day" onClick={() => pickDay(addDays(pickerDay, -1))} disabled={pickerDay <= pickerMin}>‹</button>
          <input type="date" className="date" min={pickerMin} max={pickerMax} value={pickerDay} aria-label={fcOpen ? "Forecast day" : "Replay day"}
            onChange={e => e.target.value && pickDay(e.target.value)} />
          <button className="icon-btn" type="button" aria-label="Next day" onClick={() => pickDay(addDays(pickerDay, 1))} disabled={pickerDay >= pickerMax}>›</button>
        </div>
        {!fcOpen && (
          <div className="range-picker">
            <input type="date" className="date" min="2001-01-01" max={DATA_TO} value={from} aria-label="Interval start"
              onChange={e => e.target.value && setRange(e.target.value, e.target.value > to ? e.target.value : to)} />
            <span aria-hidden="true">–</span>
            <input type="date" className="date" min="2001-01-01" max={DATA_TO} value={to} aria-label="Interval end"
              onChange={e => e.target.value && setRange(e.target.value < from ? e.target.value : from, e.target.value)} />
          </div>
        )}
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
            <button className={fcOpen ? "on" : ""} type="button" aria-pressed={fcOpen} onClick={() => setParams({ right: fcOpen ? undefined : "fc" })}>
              <Icon name="trend" />
              Forecast
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
          <Sidebar side="left" title={firesFrom ? "Fires in the interval" : "Active fires"} sub={rd ? `${rd.counts.all} in Europe` : null} onClose={() => setParams({ left: "0" })}>
            {() => (
              <FiresPanel
                data={rd}
                filter={filter}
                onFilter={f => setParams({ filter: f === "all" ? undefined : f })}
                selectedId={selectedFire?.id}
                onPick={f => setParams({ c: f.iso2, box: undefined, fire: f.id, right: right === "help" ? "help" : undefined })}
              />
            )}
          </Sidebar>
        )}

        <div className="stage">
          <div className="map-toolbar">
            {fcOpen ? (
              <Segmented options={[["model", "Forecast"], ["real", "What happened"], ["split", "Side by side"]]} value={fcView} onChange={v => setParams({ fv: v === "model" ? undefined : v })} label="Forecast view" />
            ) : s ? (
              <Segmented options={[["before", "Before"], ["after", "After"]]} value={simView} onChange={v => setParams({ view: v === "after" ? undefined : v })} label="Simulation view" />
            ) : p ? (
              <>
                <Segmented options={[["before", "Before"], ["after", "With help"]]} value={after ? "after" : "before"} onChange={v => (v === "before" ? setPhase("hold") : setPhase("after"))} label="Plan view" />
                <button className="tool" type="button" aria-label="Replay" title="Play the plan again" onClick={playPlan}>
                  <Icon name="play" />
                  <span className="tool-label">Replay</span>
                </button>
              </>
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
            {!s && !p && !fcOpen && (
              <label className="check check-ink">
                <input type="checkbox" checked={showFires} onChange={e => setParams({ fires: e.target.checked ? undefined : "0" })} />
                Fires
              </label>
            )}
            {!fcOpen && <>
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
            </>}
          </div>
          {replay.error && <p className="notice floating-notice">Could not load {longDate(replayDate)}: {replay.error.message}</p>}
          {fcOpen && fcView === "split" ? (
            <div className="split">
              <EuropeMap fill={riskFill("model")} selected={null} onSelect={undefined} forecast={fcLayer(true, false)} sync="fc" title="Forecast" ariaLabel="Forecast map" />
              <EuropeMap fill={riskFill("real")} selected={null} onSelect={undefined} forecast={fcLayer(false, true)} tiles={realTiles} sync="fc" title="What happened" ariaLabel="Map of what happened" />
            </div>
          ) : fcOpen ? (
            <EuropeMap fill={fill} selected={null} onSelect={undefined} forecast={fcLayer(fcView === "model", true)} tiles={fcView === "real" ? realTiles : null} ariaLabel="Forecast map" />
          ) : (
          <EuropeMap
            fill={fill}
            selected={s ? null : p ? p.recipient : iso2}
            outline={s ? [...new Set(simShocks.map(x => x.iso2))] : p && after ? p.donors.map(d => d.iso2) : []}
            badges={p ? planBadges : badges}
            regionShapes={helpShapes || regionShapes}
            flows={flows}
            slowFade={Boolean(p)}
            cells={cells}
            tiles={tileUrl}
            soil={detectionsOn && layers.soil ? api.firms.soilUrl(layers.soilCls) : null}
            incidents={incidentsOn && incidentData.data ? { key: `${from}-${to}-${dataVersion}-${incidentData.data.features.length}`, data: incidentData.data } : null}
            hatch={!s && !p && !fcOpen && (mapLayer === "power" || mapLayer === "amber") ? NEIGHBOUR_CODES : []}
            onSelect={drawing ? undefined : selectCountry}
            fires={showFires && !p && !s ? fires : []}
            callout={showFires && !p && !s && calloutFire ? { lat: calloutFire.lat, lon: calloutFire.lon, title: calloutFire.name, sub: `${dec(calloutFire.ratio, 1)}× the ${month} median` } : null}
            flyTo={selectedFire ? [selectedFire.lat, selectedFire.lon] : null}
            focus={p && p.status !== "no_fires" ? [p.incident, ...p.regions.map(g => g.anchor), ...p.donors.map(d => d.departure)] : box ? [[box[1], box[0]], [box[3], box[2]]] : null}
            flyOnSelect
            drawing={drawing}
            onDraw={setBox}
            box={box}
            ariaLabel="Map of Europe"
          />
          )}
          <MapLegend risk={fcOpen ? fcOpts : null} layer={s ? "power" : mapLayer} help={Boolean(p)} title={s ? `Power, ${simView}` : null} bubbles={showFires && !s && mapLayer !== "dryness"} month={dryGrid.data?.month ? new Date(`${dryGrid.data.month}-01`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : null} />
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
          <Sidebar side="right" title="Detections" sub={`${areaTitle}, ${longDate(from)} to ${longDate(to)}`} onClose={() => setParams({ right: undefined })} width={400}>
            {() => (
              <DataPanel
                summary={summary}
                sources={sources}
                pipeline={pipeline}
                query={firmsQ}
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
        {fcOpen && (
          <Sidebar side="right" title="Forecast" sub="Fires seen by both sensors" onClose={() => setParams({ right: undefined })} width={400}>
            {() => (
              <ForecastPanel day={fd} last={fcLast} setDay={setFd} risk={risk} forecast={{ ...forecast, data: fcData, loading: forecast.loading || !fcReady }} opts={fcOpts} setOpts={setFcOpts}
                modelVersion={modelVersion} onModelChanged={() => setModelVersion(v => v + 1)} />
            )}
          </Sidebar>
        )}
        {right === "help" && (
          <Sidebar side="right" title="Who can help" sub={`Fires on ${longDate(replayDate)}`} onClose={() => setParams({ right: undefined })} width={400}>
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
        onRange={(a, b) => setRange(a, b, { right: right === "help" ? "help" : undefined, tab: "range" })}
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
