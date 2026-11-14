export const HAZARDS = [
  ["WF", "Fire"],
  ["FL", "Flood"],
  ["EQ", "Quake"],
  ["DR", "Drought"],
  ["TC", "Storm"],
  ["VO", "Volcano"]
];
export const HAZARD_NAME = Object.fromEntries(HAZARDS);
export const ALERTS = ["Green", "Orange", "Red"];
export const ALERT_COLOR = { Green: "#2f7d4f", Orange: "#d97706", Red: "#c2410c" };

const s = (iso2, type, alert, count = 1) => ({ iso2, type, alert, count });

export const STORIES = [
  {
    id: "med",
    title: "Mediterranean heatwave",
    text: "Fires break out across the south at once",
    shocks: [s("GR", "WF", "Red", 2), s("IT", "WF", "Red", 3), s("ES", "WF", "Red", 2), s("PT", "WF", "Orange", 2)]
  },
  {
    id: "floods",
    title: "Central European floods",
    text: "Rivers burst while the south is burning",
    shocks: [s("DE", "FL", "Red"), s("AT", "FL", "Red"), s("CZ", "FL", "Orange"), s("PL", "FL", "Orange")]
  },
  {
    id: "balkan",
    title: "Quake in fire season",
    text: "An earthquake hits a country already on fire",
    shocks: [s("GR", "EQ", "Red"), s("BG", "WF", "Orange", 2), s("RO", "FL", "Orange")]
  },
  {
    id: "north",
    title: "Nordic drought",
    text: "A dry summer turns the forests into fuel",
    shocks: [s("SE", "DR", "Orange"), s("SE", "WF", "Orange", 2), s("FI", "DR", "Orange"), s("FI", "WF", "Orange")]
  }
];

const A = { Green: "G", Orange: "O", Red: "R" };
const AR = { G: "Green", O: "Orange", R: "Red" };

export const encodeShocks = list => list.map(x => `${x.iso2}.${x.type}.${A[x.alert]}.${x.count}`).join("_");

export function decodeShocks(text) {
  if (!text) return [];
  return text
    .split("_")
    .map(part => {
      const [iso2, type, alert, count] = part.split(".");
      if (!iso2 || !HAZARD_NAME[type] || !AR[alert]) return null;
      return { iso2, type, alert: AR[alert], count: Math.max(1, Math.min(10, Number(count) || 1)) };
    })
    .filter(Boolean);
}

export function toRequest(list, date) {
  const by = {};
  list.forEach(x => (by[x.iso2] = [...(by[x.iso2] || []), { type: x.type, alert: x.alert, count: x.count }]));
  return { date, shocks: Object.entries(by).map(([iso2, events]) => ({ iso2, events })) };
}

export function summarize(rows) {
  const avg = k => rows.reduce((t, r) => t + r[k], 0) / Math.max(rows.length, 1);
  const below = k => rows.filter(r => r[k] < 50).length;
  const shocked = rows.filter(r => r.shocked);
  return {
    avgBefore: avg("power_before"),
    avgAfter: avg("power_after"),
    belowBefore: below("power_before"),
    belowAfter: below("power_after"),
    committed: shocked.reduce((t, r) => t + Math.min(r.crew_demand, r.firefighters), 0),
    unmet: rows.reduce((t, r) => t + r.unmet_demand, 0),
    redBefore: rows.filter(r => r.band_before === "Red").length,
    redAfter: rows.filter(r => r.band_after === "Red").length,
    worst: [...rows].sort((a, b) => a.power_change - b.power_change)[0],
    hit: shocked.length
  };
}
