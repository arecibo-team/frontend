import { MONTHS, ordinal } from "./format.js";

export function normalSentence(n, country, { answer = true } = {}) {
  const month = MONTHS[n.month - 1];
  const times = `${Number(n.ratio).toFixed(1)} times the median`;
  const which = n.rank === 1 ? "the most" : `the ${ordinal(n.rank)} most`;
  if (n.rank <= 3 && n.ratio >= 1) {
    const lead = answer ? "No. " : "";
    return `${lead}${month} ${n.year} is already ${which} active ${month} in ${country} since ${n.since}, at ${times}.`;
  }
  if (n.ratio >= 1.5) {
    const lead = answer ? "Not quite. " : "";
    return `${lead}${month} ${n.year} is already busier than a usual ${month} in ${country}, at ${times}.`;
  }
  if (n.ratio >= 0.5) {
    const lead = answer ? "Yes. " : "";
    return `${lead}So far ${month} ${n.year} looks like a usual ${month} in ${country}, at ${times}.`;
  }
  const lead = answer ? "Yes. " : "";
  return `${lead}${month} ${n.year} is quiet so far in ${country}, at ${times}.`;
}

export function historySentence(n) {
  const month = MONTHS[n.month - 1];
  const which = n.rank === 1 ? "the most" : `the ${ordinal(n.rank)} most`;
  if (n.rank <= 3 && n.ratio >= 1) return `${month} ${n.year} is ${which} active ${month} since ${n.since}, at ${Number(n.ratio).toFixed(1)} times the median`;
  return `${month} ${n.year} is at ${Number(n.ratio).toFixed(1)} times the ${month} median, ${ordinal(n.rank)} of ${n.years} years since ${n.since}`;
}
