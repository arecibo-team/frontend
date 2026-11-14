export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export const num = v => (v == null ? "–" : Math.round(v).toLocaleString("en-GB"));
export const dec = (v, d = 2) => (v == null ? "–" : Number(v).toFixed(d));
export const ratio = v => `${Number(v).toFixed(1)}×`;
export const word = n => WORDS[n] || String(n);

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m, day: d };
}

export const longDate = iso => {
  const { year, month, day } = parseDate(iso);
  return `${day} ${MONTHS[month - 1]} ${year}`;
};

export const dayMonth = iso => {
  const { month, day } = parseDate(iso);
  return `${day} ${MONTHS[month - 1]}`;
};

export const shortDay = iso => {
  const { month, day } = parseDate(iso);
  return `${day} ${MONTHS_SHORT[month - 1]}`;
};

export const monthYear = iso => {
  const { year, month } = parseDate(iso);
  return `${MONTHS[month - 1]} ${year}`;
};

export function partOfMonth(iso) {
  const { month, day } = parseDate(iso);
  const part = day <= 10 ? "early" : day <= 20 ? "mid-" : "late";
  return `${part}${part.endsWith("-") ? "" : " "}${MONTHS[month - 1]}`;
}

export const possessive = name => (name.endsWith("s") ? `${name}'` : `${name}'s`);

export function listJoin(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function hours(h) {
  return `${Math.round(h)} h`;
}
