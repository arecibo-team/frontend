import Segmented from "../components/Segmented.jsx";
import { num, ratio } from "../lib/format.js";

const FILTERS = [["all", "All"], ["above", "Above normal"], ["watch", "Watch"]];
const STATUS_COLOR = { above: "#d9480f", watch: "#e7a33e", normal: "#c5c8cd" };

export default function FiresPanel({ data, filter, onFilter, selectedId, onPick }) {
  const fires = data?.fires || [];
  const shown = filter === "all" ? fires : fires.filter(f => f.status === filter);
  return (
    <div className="fires">
      <div className="fires-filter">
        <Segmented options={FILTERS} value={filter} onChange={onFilter} full label="Filter fires" />
      </div>
      {shown.map(f => (
        <button key={f.id} type="button" className={`fire${f.id === selectedId ? " on" : ""}`} onClick={() => onPick(f)}>
          <i className="dot" style={{ background: STATUS_COLOR[f.status] }} />
          <span className="name">{f.name}</span>
          <span className={`ratio ${f.status === "above" ? "above" : ""}`} title="This month against the 2001–2020 median of the area around it">
            {ratio(f.ratio)}
          </span>
          <span className="meta">
            {f.country}, {num(f.detections)} hotspots, day {f.day}
          </span>
          <span className="pass">
            {f.last_sensor} {f.last_time}
          </span>
        </button>
      ))}
      {data && shown.length === 0 && <p className="fires-empty">No fires in this group.</p>}
    </div>
  );
}
