export const DATA_FROM = "2001-01-01";
export const DATA_TO = "2025-12-31";
export const REPLAY_FROM = "2012-01-20";
export const DEFAULT_DATE = "2021-08-08";

export const pad = n => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const clampDate = d => (!d ? DEFAULT_DATE : d < DATA_FROM ? DATA_FROM : d > DATA_TO ? DATA_TO : d);
export const clampReplay = d => (d < REPLAY_FROM ? REPLAY_FROM : d > DATA_TO ? DATA_TO : d);

export function addDays(d, n) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function presets(asof) {
  const y = Number(asof.slice(0, 4));
  const m = Number(asof.slice(5, 7));
  const season = iso(y, 6, 1) > asof ? y - 1 : y;
  const seasonEnd = iso(season, 9, 30) < asof ? iso(season, 9, 30) : asof;
  const back = d => (d < DATA_FROM ? DATA_FROM : d);
  return [
    ["This month", iso(y, m, 1), asof],
    ["30 days", back(addDays(asof, -29)), asof],
    ["Jun–Sep", iso(season, 6, 1), seasonEnd],
    ["This year", iso(y, 1, 1), asof],
    ["5 years", back(iso(y - 4, 1, 1)), asof],
    ["All", DATA_FROM, asof]
  ];
}
