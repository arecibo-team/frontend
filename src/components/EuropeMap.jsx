import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Pane, Polyline, Rectangle, ScaleControl, TileLayer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import { BASEMAPS, EUROPE_BOUNDS, FLY_DURATION, HOME_BOUNDS, MAX_ZOOM, basemapHasOwnLabels } from "../config.js";
import { fireRadius } from "../lib/geo.js";
import { REAL_RING, pctText, probColor, probT } from "../lib/forecast.js";
import MinZoomLock from "./MinZoomLock.jsx";
import Basemap from "./Basemap.jsx";
import CountriesLayer from "./CountriesLayer.jsx";
import CountryLabels from "./CountryLabels.jsx";
import LayerSwitcher from "./LayerSwitcher.jsx";
import ResetViewButton from "./ResetViewButton.jsx";

const STORE = "arecibo.map";

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
    return {
      basemap: BASEMAPS.some(b => b.id === saved.basemap) ? saved.basemap : BASEMAPS[0].id,
      bordersOn: saved.bordersOn !== false,
      namesOn: saved.namesOn !== false
    };
  } catch {
    return { basemap: BASEMAPS[0].id, bordersOn: true, namesOn: true };
  }
}

function HatchPattern() {
  const map = useMap();
  useEffect(() => {
    const add = () => {
      const svg = map.getPane("overlayPane")?.querySelector("svg");
      if (!svg || svg.querySelector("#map-hatch")) return;
      const ns = "http://www.w3.org/2000/svg";
      const defs = document.createElementNS(ns, "defs");
      defs.innerHTML =
        '<pattern id="map-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<rect width="6" height="6" fill="#eef0f3"/><line x1="0" y1="0" x2="0" y2="6" stroke="#b9bec6" stroke-width="1.4"/></pattern>';
      svg.insertBefore(defs, svg.firstChild);
    };
    add();
    map.on("layeradd", add);
    return () => map.off("layeradd", add);
  }, [map]);
  return null;
}

function KeepHomeView({ enabled }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    let touched = false;
    const mark = () => (touched = true);
    const refit = () => {
      if (!touched) map.fitBounds(HOME_BOUNDS, { animate: false });
    };
    const container = map.getContainer();
    container.addEventListener("pointerdown", mark);
    container.addEventListener("wheel", mark, { passive: true });
    container.addEventListener("keydown", mark);
    map.on("resize", refit);
    const timer = setTimeout(refit, 0);
    return () => {
      clearTimeout(timer);
      container.removeEventListener("pointerdown", mark);
      container.removeEventListener("wheel", mark);
      container.removeEventListener("keydown", mark);
      map.off("resize", refit);
    };
  }, [map, enabled]);
  return null;
}

function DrawBox({ active, onDraw }) {
  const map = useMap();
  const latest = useRef(onDraw);
  latest.current = onDraw;
  useEffect(() => {
    if (!active) return;
    map.dragging.disable();
    map.boxZoom.disable();
    let start = null;
    let rect = null;
    const down = e => {
      start = e.latlng;
      rect = L.rectangle([start, start], { color: "#d9480f", weight: 2, dashArray: "6 4", fillOpacity: 0.08, interactive: false }).addTo(map);
    };
    const move = e => {
      if (start && rect) rect.setBounds([start, e.latlng]);
    };
    const up = e => {
      if (!start) return;
      const b = L.latLngBounds(start, e.latlng);
      start = null;
      if (rect) map.removeLayer(rect);
      rect = null;
      const r = v => Math.round(v * 100) / 100;
      const swallow = ev => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      const container = map.getContainer();
      container.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => container.removeEventListener("click", swallow, { capture: true }), 400);
      if (Math.abs(b.getEast() - b.getWest()) < 0.02 || Math.abs(b.getNorth() - b.getSouth()) < 0.02) return;
      latest.current?.([r(b.getWest()), r(b.getSouth()), r(b.getEast()), r(b.getNorth())]);
    };
    map.on("mousedown", down);
    map.on("mousemove", move);
    map.on("mouseup", up);
    return () => {
      map.off("mousedown", down);
      map.off("mousemove", move);
      map.off("mouseup", up);
      if (rect) map.removeLayer(rect);
      map.dragging.enable();
      map.boxZoom.enable();
    };
  }, [map, active]);
  return null;
}

function CellLayer({ cells }) {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane("cells")) {
      const pane = map.createPane("cells");
      pane.style.zIndex = 440;
      pane.style.pointerEvents = "none";
    }
    const renderer = L.canvas({ pane: "cells", padding: 0.2 });
    const half = cells.res / 2;
    const group = L.layerGroup(
      cells.data.map(([lat, lon, v]) =>
        L.rectangle([[lat - half, lon - half], [lat + half, lon + half]], {
          renderer, stroke: false, fillColor: cells.color(v), fillOpacity: cells.opacity ?? 0.78, interactive: false
        })
      )
    ).addTo(map);
    return () => group.remove();
  }, [map, cells.key]);
  return null;
}

const CELL_M = 5500;

function cellRadius(zoom, lat) {
  const mPerPx = (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return Math.min(40, Math.max(3.5, CELL_M / mPerPx));
}

function ForecastLayer({ forecast }) {
  const map = useMap();
  const { data: f, model, real, alerts } = forecast;
  useEffect(() => {
    if (!f) return undefined;
    if (!map.getPane("forecast")) map.createPane("forecast").style.zIndex = 470;
    const renderer = L.canvas({ pane: "forecast", padding: 0.2 });
    const zoom = map.getZoom();
    const marks = [];
    const group = L.layerGroup();
    if (model) {
      Array.from({ length: f.p.length }, (_, i) => i)
        .filter(i => !alerts || f.p[i] >= f.threshold)
        .sort((a, b) => f.p[a] - f.p[b])
        .forEach(i => {
          const p = f.p[i];
          const alert = p >= f.threshold;
          const m = L.circleMarker([f.lat[i], f.lon[i]], {
            renderer, radius: cellRadius(zoom, f.lat[i]), stroke: alert, color: "#ffffff", weight: 1.2,
            fillColor: probColor(p), fillOpacity: alert ? 0.95 : 0.2 + 0.5 * probT(p)
          });
          const then = f.actual[i] ? "a confirmed fire followed" : f.complete ? "no confirmed fire followed" : "outcome not known yet";
          m.bindTooltip(`<b>${pctText(p)}</b>${alert ? " alert" : ""}<br>${then}`, { sticky: true, className: "region-tip" });
          marks.push([i, m, 0]);
          m.addTo(group);
        });
    }
    if (real) {
      for (let i = 0; i < f.p.length; i++) {
        if (!f.actual[i]) continue;
        const m = L.circleMarker([f.lat[i], f.lon[i]], { renderer, radius: cellRadius(zoom, f.lat[i]) + 2.5, color: REAL_RING, weight: 1.5, fill: false });
        m.bindTooltip(`<b>Confirmed fire</b><br>Model had ${pctText(f.p[i])}, ${f.p[i] >= f.threshold ? "a hit" : "a miss"}`, { sticky: true, className: "region-tip" });
        marks.push([i, m, 2.5]);
        m.addTo(group);
      }
    }
    const resize = () => {
      const z = map.getZoom();
      marks.forEach(([i, m, extra]) => m.setRadius(cellRadius(z, f.lat[i]) + extra));
    };
    map.on("zoomend", resize);
    group.addTo(map);
    return () => {
      map.off("zoomend", resize);
      group.remove();
      renderer.remove();
    };
  }, [map, f, model, real, alerts]);
  return null;
}

const syncGroups = new Map();
let syncing = false;

function MapSync({ group }) {
  const map = useMap();
  useEffect(() => {
    const set = syncGroups.get(group) || new Set();
    syncGroups.set(group, set);
    const other = [...set][0];
    if (other) map.setView(other.getCenter(), other.getZoom(), { animate: false });
    set.add(map);
    const onMove = () => {
      if (syncing) return;
      syncing = true;
      set.forEach(m => m !== map && m.setView(map.getCenter(), map.getZoom(), { animate: false }));
      syncing = false;
    };
    map.on("move", onMove);
    return () => {
      map.off("move", onMove);
      set.delete(map);
    };
  }, [map, group]);
  return null;
}

function FitTo({ points }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    if (!points || points.length < 2) return;
    map.flyToBounds(L.latLngBounds(points), { paddingTopLeft: [48, 96], paddingBottomRight: [48, 48], maxZoom: 8, duration: FLY_DURATION });
  }, [map, key]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  const key = target ? target.join(",") : "";
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 6), { duration: FLY_DURATION });
  }, [map, key]);
  return null;
}

function curve(from, to, bend = 0.2, steps = 32) {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;
  const cLat = (lat1 + lat2) / 2 + (lon2 - lon1) * bend;
  const cLon = (lon1 + lon2) / 2 - (lat2 - lat1) * bend;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = (1 - t) ** 2;
    const b = 2 * (1 - t) * t;
    const c = t ** 2;
    pts.push([a * lat1 + b * cLat + c * lat2, a * lon1 + b * cLon + c * lon2]);
  }
  return pts;
}

function calloutIcon(title, sub) {
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  return L.divIcon({
    className: "map-callout",
    iconSize: null,
    html: `<svg width="46" height="40"><line x1="0" y1="40" x2="42" y2="4" stroke="#18181b" stroke-width="1"/></svg><div><b>${esc(title)}</b><span>${esc(sub)}</span></div>`
  });
}

const badgeCache = new Map();
function badgeIcon({ label, color, row }) {
  const k = `${label}|${color}|${row}`;
  if (!badgeCache.has(k)) {
    badgeCache.set(k, L.divIcon({ className: "hz-badge", iconSize: null, html: `<span style="--c:${color};--row:${row}">${label}</span>` }));
  }
  return badgeCache.get(k);
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
  focus,
  flyTo,
  flyOnSelect = false,
  drawing = false,
  onDraw,
  box,
  badges = [],
  tiles,
  incidents,
  regionShapes,
  cells,
  flows = [],
  slowFade = false,
  soil,
  forecast,
  sync,
  title,
  ariaLabel = "Map of the EU"
}) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const set = patch =>
    setPrefs(p => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        return next;
      }
      return next;
    });
  const shapesRef = useRef(regionShapes);
  shapesRef.current = regionShapes;
  const maxFlow = Math.max(...flows.map(f => f.n), 1);
  const tone = BASEMAPS.find(b => b.id === prefs.basemap)?.labelTone === "dark" ? " labels-dark" : "";
  const icon = useMemo(() => (callout ? calloutIcon(callout.title, callout.sub) : null), [callout?.title, callout?.sub]);

  return (
    <div className={`map-box${tone}${drawing ? " drawing" : ""}${slowFade ? " slow-fade" : ""}`} role="region" aria-label={ariaLabel}>
      {drawing && <div className="draw-hint">Drag on the map to draw your area</div>}
      {title && <div className="map-title">{title}</div>}
      <MapContainer
        className="map"
        bounds={HOME_BOUNDS}
        maxBounds={EUROPE_BOUNDS}
        maxBoundsViscosity={1.0}
        maxZoom={MAX_ZOOM}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={90}
        wheelDebounceTime={20}
        inertia
        inertiaDeceleration={2500}
        fadeAnimation={false}
        zoomControl={false}
        attributionControl
      >
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomright" imperial={false} />
        <MinZoomLock />
        <KeepHomeView enabled={!focus && !sync} />
        {sync && <MapSync group={sync} />}
        <Basemap basemap={prefs.basemap} />
        <HatchPattern />
        <CountriesLayer
          fill={fill}
          outline={outline}
          hatch={hatch}
          selected={selected}
          bordersOn={prefs.bordersOn}
          onSelect={onSelect}
          flyOnSelect={flyOnSelect}
        />
        <CountryLabels visible={prefs.namesOn && basemapHasOwnLabels(prefs.basemap)} />
        {regionShapes && (
          <Pane name="regions" style={{ zIndex: 430 }}>
            <GeoJSON
              key={regionShapes.key}
              data={regionShapes.data}
              style={regionShapes.style}
              onEachFeature={(f, layer) => {
                layer.bindTooltip(() => shapesRef.current?.tooltip(f) || "", { sticky: true, className: "region-tip" });
                layer.on({
                  mouseover: () => layer.setStyle({ weight: 2, color: "#18181b" }),
                  mouseout: () => shapesRef.current && layer.setStyle(shapesRef.current.style(f)),
                  click: e => {
                    L.DomEvent.stopPropagation(e);
                    shapesRef.current?.onClick?.(f.properties);
                  }
                });
              }}
            />
          </Pane>
        )}
        {cells && <CellLayer cells={cells} />}
        {forecast && <ForecastLayer forecast={forecast} />}
        {soil && (
          <Pane name="soil" style={{ zIndex: 445, pointerEvents: "none" }}>
            <TileLayer key={soil} url={soil} opacity={0.85} maxZoom={MAX_ZOOM} maxNativeZoom={12} />
          </Pane>
        )}
        {tiles && (
          <Pane name="detections" style={{ zIndex: 450, pointerEvents: "none" }}>
            <TileLayer key={tiles} url={tiles} opacity={0.95} maxZoom={MAX_ZOOM} maxNativeZoom={12} />
          </Pane>
        )}
        {incidents && (
          <Pane name="incidents" style={{ zIndex: 460 }}>
            <GeoJSON
              key={incidents.key}
              data={incidents.data}
              style={() => ({ color: "#7c2d12", weight: 1.5, dashArray: "4 3", fillColor: "#7c2d12", fillOpacity: 0.08 })}
              onEachFeature={(f, layer) => {
                const p = f.properties;
                layer.bindTooltip(
                  `<b>${p.name || p.source}</b><br>${p.source}, ${p.start_date} to ${p.end_date}${p.area_ha ? `<br>${Math.round(p.area_ha).toLocaleString("en-GB")} ha` : ""}${p.detections ? `, ${p.detections.toLocaleString("en-GB")} detections` : ""}`,
                  { sticky: true }
                );
              }}
            />
          </Pane>
        )}
        <Pane name="marks" style={{ zIndex: 620, pointerEvents: "none" }}>
          {flows.map(f => (
            <Polyline
              key={`base-${f.key}`}
              positions={curve(f.from, f.to)}
              className={`flow-base flow-${f.kind} o${Math.min(f.order, 7)}`}
              interactive={false}
              pathOptions={{ weight: 1.5 + 5 * Math.sqrt(f.n / maxFlow) }}
            />
          ))}
          {flows.map(f => (
            <Polyline
              key={`run-${f.key}`}
              positions={curve(f.from, f.to)}
              className={`flow-run flow-${f.kind} o${Math.min(f.order, 7)}`}
              interactive={false}
              pathOptions={{ weight: Math.max(1.5, 0.5 * (1.5 + 5 * Math.sqrt(f.n / maxFlow))) }}
            />
          ))}
          {flows.map(f => (
            <CircleMarker key={`end-${f.key}`} center={f.from} radius={3} className={`flow-dot o${Math.min(f.order, 7)}`} interactive={false} pathOptions={{ weight: 0, fillOpacity: 1 }} />
          ))}
          {routes.map((r, i) =>
            r.from && r.to ? (
              <Polyline key={`r-${i}`} positions={curve(r.from, r.to)} pathOptions={{ color: "#18181b", weight: r.width, dashArray: "6 5", interactive: false }} />
            ) : null
          )}
          {routes.map((r, i) =>
            r.from ? <CircleMarker key={`o-${i}`} center={r.from} radius={3.5} pathOptions={{ color: "#18181b", fillColor: "#18181b", fillOpacity: 1, weight: 0 }} /> : null
          )}
          {fires.map(f => (
            <CircleMarker
              key={f.id}
              center={[f.lat, f.lon]}
              radius={fireRadius(f.hotspots_24h)}
              pathOptions={{ color: "#d9480f", weight: 1.2, fillColor: "#d9480f", fillOpacity: 0.16, interactive: false }}
            />
          ))}
          {fires.map(f => (
            <CircleMarker key={`c-${f.id}`} center={[f.lat, f.lon]} radius={3} pathOptions={{ color: "#d9480f", weight: 0, fillColor: "#d9480f", fillOpacity: 1, interactive: false }} />
          ))}
          {incident && <CircleMarker center={incident} radius={7} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#d9480f", fillOpacity: 1, interactive: false }} />}
        </Pane>
        <Pane name="badges" style={{ zIndex: 690, pointerEvents: "none" }}>
          {badges.map(bd => (
            <Marker key={bd.key} position={[bd.lat, bd.lon]} icon={badgeIcon(bd)} interactive={false} keyboard={false} />
          ))}
        </Pane>
        <Pane name="callout" style={{ zIndex: 700, pointerEvents: "none" }}>
          {callout && icon && <Marker position={[callout.lat, callout.lon]} icon={icon} interactive={false} keyboard={false} />}
        </Pane>
        {box && (
          <Rectangle
            bounds={[[box[1], box[0]], [box[3], box[2]]]}
            pathOptions={{ color: "#d9480f", weight: 2, dashArray: "6 4", fillOpacity: 0.06, interactive: false }}
          />
        )}
        <DrawBox active={drawing} onDraw={onDraw} />
        <FitTo points={focus} />
        <FlyTo target={flyTo} />
        <ResetViewButton />
        <LayerSwitcher
          basemap={prefs.basemap}
          onBasemapChange={basemap => set({ basemap })}
          bordersOn={prefs.bordersOn}
          onBordersChange={bordersOn => set({ bordersOn })}
          namesOn={prefs.namesOn}
          onNamesChange={namesOn => set({ namesOn })}
        />
      </MapContainer>
    </div>
  );
}
