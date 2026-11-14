import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, COUNTRY_NAMES, fireRadius, makeProjection, pathFor } from "../lib/geo.js";

function useSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function curve(a, b, bend = 0.18) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  return `M${a[0]},${a[1]} Q${cx},${cy} ${b[0]},${b[1]}`;
}

export default function EuropeMap({
  fill,
  outline = [],
  hatch = [],
  selected,
  onSelect,
  fires = [],
  callout,
  routes = [],
  incident,
  dimNonEu = "#e4e6ea",
  ariaLabel = "Map of the EU"
}) {
  const box = useRef(null);
  const { width, height } = useSize(box);
  const projection = useMemo(() => (width && height ? makeProjection(width, height) : null), [width, height]);
  const path = useMemo(() => (projection ? pathFor(projection) : null), [projection]);
  const shapes = useMemo(
    () => (path ? COUNTRIES.map((f, i) => ({ key: `${f.id || "x"}-${i}`, iso2: f.iso2, d: path(f) })).filter(s => s.d) : []),
    [path]
  );
  const [hover, setHover] = useState(null);

  const outlined = new Set([...(selected ? [selected] : []), ...outline]);
  const hatched = new Set(hatch);
  const project = (lon, lat) => projection([lon, lat]);

  return (
    <div className="map-box" ref={box}>
      {projection && (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
          <defs>
            <clipPath id="map-frame">
              <rect x="0" y="0" width={width} height={height} />
            </clipPath>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#eef0f3" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#c9cdd3" strokeWidth="1.2" />
            </pattern>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8" fill="none" stroke="#18181b" strokeWidth="1.3" />
            </marker>
          </defs>
          <g clipPath="url(#map-frame)">
            {shapes.map(s => {
              const eu = Boolean(s.iso2);
              const color = eu ? fill(s.iso2) : dimNonEu;
              return (
                <path
                  key={s.key}
                  d={s.d}
                  fill={hatched.has(s.iso2) ? "url(#hatch)" : color}
                  stroke="#ffffff"
                  strokeWidth={eu ? 0.8 : 0.6}
                  strokeLinejoin="round"
                  style={{ cursor: eu && onSelect ? "pointer" : "default" }}
                  opacity={eu && hover && hover !== s.iso2 && onSelect ? 0.92 : 1}
                  onMouseEnter={() => eu && setHover(s.iso2)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => eu && onSelect && onSelect(s.iso2)}
                >
                  {eu && <title>{COUNTRY_NAMES[s.iso2]}</title>}
                </path>
              );
            })}
            {shapes
              .filter(s => outlined.has(s.iso2))
              .map(s => (
                <path key={`o-${s.key}`} d={s.d} fill="none" stroke="#18181b" strokeWidth="1.6" strokeLinejoin="round" pointerEvents="none" />
              ))}
            {routes.map((r, i) => {
              const a = project(...r.from);
              const b = project(...r.to);
              return (
                <g key={`r-${i}`} pointerEvents="none">
                  <path d={curve(a, b)} fill="none" stroke="#18181b" strokeWidth={r.width} strokeDasharray="5 4" markerEnd="url(#arrow)" />
                  <circle cx={a[0]} cy={a[1]} r="3.4" fill="#18181b" />
                </g>
              );
            })}
            {fires.map(f => {
              const [x, y] = project(f.lon, f.lat);
              const r = fireRadius(f.hotspots_24h);
              return (
                <g key={f.id} pointerEvents="none">
                  <circle cx={x} cy={y} r={r} fill="rgba(217,72,15,0.16)" stroke="#d9480f" strokeWidth="1.2" />
                  <circle cx={x} cy={y} r="3" fill="#d9480f" />
                </g>
              );
            })}
            {incident && (() => {
              const [x, y] = project(...incident);
              return <circle cx={x} cy={y} r="6" fill="#d9480f" stroke="#fff" strokeWidth="1.5" pointerEvents="none" />;
            })()}
            {callout && (() => {
              const [x, y] = project(callout.lon, callout.lat);
              const lx = x + 46;
              const ly = y - 40;
              return (
                <g pointerEvents="none">
                  <line x1={x} y1={y} x2={lx - 4} y2={ly + 2} stroke="#18181b" strokeWidth="1" />
                  <text x={lx} y={ly - 6} className="callout-name">{callout.title}</text>
                  <text x={lx} y={ly + 12} className="callout-sub">{callout.sub}</text>
                </g>
              );
            })()}
          </g>
        </svg>
      )}
    </div>
  );
}
