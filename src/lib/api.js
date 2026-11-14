export const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
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

export const api = {
  replay: date => request(`/replay?date=${date}`),
  history: (iso2, date) => request(`/history/${iso2}?date=${date}`),
  historyCsvUrl: (iso2, date) => `${API_URL}/history/${iso2}.csv?date=${date}`,
  area: q => request(`/area?${areaQuery(q)}`),
  areaCsvUrl: (kind, q) => `${API_URL}/area/${kind}.csv?${areaQuery(q)}`,
  simulate: body => request("/simulate", { method: "POST", body: JSON.stringify(body) }),
  plan: body => request("/plan", { method: "POST", body: JSON.stringify(body) }),
  model: () => request("/model"),
  health: () => request("/health"),
  countries: () => request("/countries")
};
