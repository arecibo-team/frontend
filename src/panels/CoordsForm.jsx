import { useState } from "react";

export default function CoordsForm({ box, onBox }) {
  const [vals, setVals] = useState(box ? box.map(String) : ["", "", "", ""]);
  const [point, setPoint] = useState({ lat: "", lon: "", km: "25" });
  const labels = ["West", "South", "East", "North"];
  const nums = vals.map(Number);
  const valid = vals.every(v => v !== "" && Number.isFinite(Number(v))) && nums[0] < nums[2] && nums[1] < nums[3];
  const usePoint = () => {
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    const km = Number(point.km);
    if (![lat, lon, km].every(Number.isFinite) || km <= 0 || point.lat === "" || point.lon === "") return;
    const dLat = km / 111.32;
    const dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180));
    const r = v => Math.round(v * 100) / 100;
    onBox([r(lon - dLon), r(lat - dLat), r(lon + dLon), r(lat + dLat)]);
  };
  return (
    <div className="coords-form">
      <form className="coords" onSubmit={e => { e.preventDefault(); if (valid) onBox(nums); }}>
        <h3 className="h3">Box, in degrees</h3>
        <div className="coords-row">
          {labels.map((l, i) => (
            <label key={l}>
              <span>{l}</span>
              <input inputMode="decimal" value={vals[i]} onChange={e => setVals(v => v.map((x, j) => (j === i ? e.target.value : x)))} />
            </label>
          ))}
          <button className="btn" type="submit" disabled={!valid}>Use box</button>
        </div>
      </form>
      <form className="coords" onSubmit={e => { e.preventDefault(); usePoint(); }}>
        <h3 className="h3">Point and distance</h3>
        <div className="coords-row">
          <label><span>Latitude</span><input inputMode="decimal" value={point.lat} onChange={e => setPoint({ ...point, lat: e.target.value })} /></label>
          <label><span>Longitude</span><input inputMode="decimal" value={point.lon} onChange={e => setPoint({ ...point, lon: e.target.value })} /></label>
          <label><span>Within km</span><input inputMode="decimal" value={point.km} onChange={e => setPoint({ ...point, km: e.target.value })} /></label>
          <button className="btn" type="submit">Use point</button>
        </div>
      </form>
    </div>
  );
}
