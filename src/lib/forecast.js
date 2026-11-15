import { ALL_NAMES } from "./geo.js";

export const FORECAST_FROM = "2023-01-01";
export const FUTURE_DAYS = 6;
export const WAR = new Set(["Ukraine", "Russia"]);
export const REAL_RING = "#1c6fd6";

const ALIAS = { "Bosnia and Herz.": "Bosnia and Herzegovina", "Macedonia": "North Macedonia" };
const DENSITY_LO = 0.01;
const DENSITY_HI = 1;
const RAMP = [[0, "#eceef1"], [0.15, "#f3e3d3"], [0.4, "#f2bd8f"], [0.7, "#e2702f"], [0.9, "#b53a0a"], [1, "#7a1d06"]].map(([t, h]) => [t, [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16))]);

function mix(stops, t) {
  const x = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1][0]) i++;
  const [t0, a] = stops[i];
  const [t1, b] = stops[i + 1];
  const k = (x - t0) / (t1 - t0);
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(",")})`;
}

export const riskColor = v => mix(RAMP, v);
export const riskWord = v => (v >= 0.9 ? "Very high" : v >= 0.7 ? "High" : v >= 0.4 ? "Elevated" : v >= 0.15 ? "Normal" : "Low");
export const riskGradient = `linear-gradient(90deg, ${RAMP.map(([t]) => `${riskColor(t)} ${t * 100}%`).join(", ")})`;

export function sideOf(c, source) {
  if (!c) return null;
  if (source === "model") return { expected: c.expected, pct: c.pct, score: c.score, density: c.density, complete: true };
  return c.real ?? null;
}

export function riskValue(c, mode, source) {
  const s = sideOf(c, source);
  if (!s) return null;
  if (mode === "own") return s.score;
  if (!s.density || s.density <= 0) return 0;
  const t = (Math.log10(s.density) - Math.log10(DENSITY_LO)) / (Math.log10(DENSITY_HI) - Math.log10(DENSITY_LO));
  return Math.min(1, Math.max(0, t));
}

export function riskByIso(risk) {
  const byName = Object.fromEntries((risk?.countries || []).map(c => [ALIAS[c.name] || c.name, c]));
  return Object.fromEntries(Object.entries(ALL_NAMES).filter(([, name]) => byName[name]).map(([iso2, name]) => [iso2, byName[name]]));
}

const P_LOW = 0.001;
export const probT = p => Math.min(1, Math.max(0, Math.log(Math.max(p, P_LOW) / P_LOW) / Math.log(1 / P_LOW)));
const PROB = [[0, "#f6dcae"], [0.5, "#ee8f3f"], [0.8, "#d9480f"], [1, "#7a1d06"]].map(([t, h]) => [t, [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16))]);
export const probColor = p => mix(PROB, probT(p));
export const pctText = p => `${(p * 100).toFixed(p < 0.01 ? 2 : 0)}%`;

export function tally(f) {
  const t = { hit: 0, miss: 0, falseAlarm: 0, alerts: 0 };
  if (!f) return t;
  for (let i = 0; i < f.p.length; i++) {
    const alert = f.p[i] >= f.threshold;
    if (alert) t.alerts++;
    if (f.actual[i]) alert ? t.hit++ : t.miss++;
    else if (alert && f.complete) t.falseAlarm++;
  }
  return t;
}

export function dayState(day, last, run, addDays) {
  if (day > last) return "future";
  const pr = run?.params;
  if (!pr?.train_end) return null;
  const ev = pr.holdout_event;
  if (ev && day >= addDays(ev.first, -pr.horizon) && day <= ev.last) return "event";
  return day <= pr.train_end ? "train" : "test";
}

export const STATE_LABEL = { train: "Training data", event: "Held-out event", test: "Never trained on", future: "Future" };
