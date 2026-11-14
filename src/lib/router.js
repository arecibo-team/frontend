import { useEffect, useState } from "react";

export const DEFAULT_DATE = "2021-08-08";
export const PAGES = ["map", "history", "help", "method"];

export function parseHash(hash = window.location.hash) {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const page = PAGES.includes(path) ? path : "map";
  const params = Object.fromEntries(new URLSearchParams(query));
  return { page, params };
}

export function buildHash(page, params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const q = new URLSearchParams(clean).toString();
  return `#/${page}${q ? `?${q}` : ""}`;
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash());
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(page, params) {
  window.location.hash = buildHash(page, params);
}

export function replaceParams(page, params) {
  const next = buildHash(page, params);
  if (window.location.hash !== next) window.history.replaceState(null, "", next);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
