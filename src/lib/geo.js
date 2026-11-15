import { feature } from "topojson-client";
import { geoBounds } from "d3-geo";
import world from "../data/europe-10m.json";

export const EU = {
  "040": "AT", "056": "BE", "100": "BG", "191": "HR", "196": "CY", "203": "CZ", "208": "DK", "233": "EE", "246": "FI",
  "250": "FR", "276": "DE", "300": "GR", "348": "HU", "372": "IE", "380": "IT", "428": "LV", "440": "LT", "442": "LU",
  "470": "MT", "528": "NL", "616": "PL", "620": "PT", "642": "RO", "703": "SK", "705": "SI", "724": "ES", "752": "SE", "248": "FI"
};

export const COUNTRY_NAMES = {
  AT: "Austria", BE: "Belgium", BG: "Bulgaria", HR: "Croatia", CY: "Cyprus", CZ: "Czechia", DK: "Denmark", EE: "Estonia",
  FI: "Finland", FR: "France", DE: "Germany", GR: "Greece", HU: "Hungary", IE: "Ireland", IT: "Italy", LV: "Latvia",
  LT: "Lithuania", LU: "Luxembourg", MT: "Malta", NL: "Netherlands", PL: "Poland", PT: "Portugal", RO: "Romania",
  SK: "Slovakia", SI: "Slovenia", ES: "Spain", SE: "Sweden"
};

export const NEIGHBOURS = {
  "804": "UA", "498": "MD", "112": "BY", "826": "GB", "578": "NO", "756": "CH", "688": "RS", "070": "BA", "499": "ME",
  "008": "AL", "792": "TR", "268": "GE", "051": "AM", "031": "AZ"
};

export const NEIGHBOUR_NAMES = {
  UA: "Ukraine", MD: "Moldova", BY: "Belarus", GB: "United Kingdom", NO: "Norway", CH: "Switzerland", RS: "Serbia",
  BA: "Bosnia and Herzegovina", ME: "Montenegro", AL: "Albania", XK: "Kosovo", TR: "Turkey", GE: "Georgia", AM: "Armenia",
  AZ: "Azerbaijan"
};

export const ALL_NAMES = { ...COUNTRY_NAMES, ...NEIGHBOUR_NAMES };

export const codeOf = f => EU[f.id] || NEIGHBOURS[f.id] || (f.properties?.name === "Kosovo" ? "XK" : null);

const VIEW = { west: -40, east: 60, south: 22, north: 82 };

const all = feature(world, world.objects.countries).features;

export const COUNTRIES = all
  .filter(f => {
    if (!f.geometry) return false;
    const [[w, s], [e, n]] = geoBounds(f);
    if (w > e) return true;
    return e >= VIEW.west && w <= VIEW.east && n >= VIEW.south && s <= VIEW.north;
  })
  .map(f => ({ ...f, iso2: codeOf(f) }));

export const POWER_STEPS = [35, 50, 65, 80];
export const POWER_COLORS = ["#e6edf6", "#c3d4e8", "#8faed4", "#4e7eb3", "#244f80"];
export const AMBER_STEPS = [40, 60, 80];
export const AMBER_COLORS = ["#fbe5d3", "#f4b383", "#e2702f", "#a83a12"];
export const BAND_COLORS = { Green: "#2f7d4f", Amber: "#d99a1c", Red: "#c2410c" };

export function classColor(value, steps, colors) {
  if (value == null) return "#e5e7eb";
  let i = 0;
  while (i < steps.length && value >= steps[i]) i++;
  return colors[i];
}

export const fireRadius = h => 4 + 13 * Math.sqrt(Math.max(h, 0) / 1200);
