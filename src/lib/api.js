export const API_URL = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
export const FIRMS_URL = (import.meta.env.VITE_FIRMS_URL ?? "").replace(/\/$/, "");
export const CONTEXT_URL = (import.meta.env.VITE_CONTEXT_URL ?? "/context").replace(/\/$/, "");

async function request(path, options = {}, base = API_URL) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      detail = res.statusText;
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export function areaQuery({ country, box, from, to, asof }) {
  const q = new URLSearchParams();
  if (box) q.set("bbox", box);
  else q.set("country", country);
  if (from) q.set("start", from);
  if (to) q.set("end", to);
  if (asof) q.set("asof", asof);
  return q.toString();
}

export function firmsQuery({ from, to, bounds }) {
  const q = new URLSearchParams({ from, to });
  if (bounds) {
    q.set("west", bounds[0]);
    q.set("south", bounds[1]);
    q.set("east", bounds[2]);
    q.set("north", bounds[3]);
  }
  return q.toString();
}

export const api = {
  replay: date => request(`/replay?date=${date}`),
  history: (iso2, date) => request(`/history/${iso2}?date=${date}`),
  historyCsvUrl: (iso2, date) => `${API_URL}/history/${iso2}.csv?date=${date}`,
  area: q => request(`/area?${areaQuery(q)}`),
  areaCsvUrl: (kind, q) => `${API_URL}/area/${kind}.csv?${areaQuery(q)}`,
  regions: date => request(`/regions?date=${date}`),
  scoreDetail: iso2 => request(`/scores/${iso2}`),
  scoreHistory: iso2 => request(`/scores/${iso2}/history`),
  customWeights: body => request("/score/custom-weights", { method: "POST", body: JSON.stringify(body) }),
  live: () => request("/live"),
  context: {
    months: () => request("/months", {}, CONTEXT_URL),
    countries: month => request(`/countries?month=${month}`, {}, CONTEXT_URL),
    country: (code, month) => request(`/countries/${code}${month ? `?month=${month}` : ""}`, {}, CONTEXT_URL),
    point: (lat, lon, month) => request(`/point?lat=${lat}&lon=${lon}${month ? `&month=${month}` : ""}`, {}, CONTEXT_URL),
    grid: (layer, month) => request(`/grid/${layer}${month ? `?month=${month}` : ""}`, {}, CONTEXT_URL)
  },
  firms: {
    weather: (lat, lon, time) => request(`/api/weather?lat=${lat}&lon=${lon}&time=${encodeURIComponent(time)}`, {}, FIRMS_URL),
    modelRuns: () => request("/api/model/runs", {}, FIRMS_URL),
    summary: q => request(`/api/summary?${firmsQuery(q)}`, {}, FIRMS_URL),
    sources: () => request("/api/sources", {}, FIRMS_URL),
    pipeline: () => request("/api/pipeline", {}, FIRMS_URL),
    incidents: q => request(`/api/incidents?${firmsQuery(q)}`, {}, FIRMS_URL),
    exportUrl: (q, sensor = "all") => `${FIRMS_URL}/api/export.csv?${firmsQuery(q)}&sensor=${sensor}`,
    tileUrl: (from, to, layers, version) => `${FIRMS_URL}/api/tiles/{z}/{x}/{y}.png?from=${from}&to=${to}&layers=${layers}&v=${version}`,
    upload: async file => {
      const res = await fetch(`${FIRMS_URL}/api/import?name=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: file
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.detail === "string" ? body.detail : `Upload failed (${res.status})`);
      return body;
    }
  },
  simulate: body => request("/simulate", { method: "POST", body: JSON.stringify(body) }),
  plan: body => request("/plan", { method: "POST", body: JSON.stringify(body) }),
  model: () => request("/model"),
  health: () => request("/health"),
  countries: () => request("/countries")
};
