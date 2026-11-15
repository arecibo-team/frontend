import { Fragment } from "react";
import Segmented from "../components/Segmented.jsx";
import { num, ratio } from "../lib/format.js";
import { FireDetail, REGION_LABEL } from "./Insights.jsx";

const FILTERS = [["all", "All"], ["above", "Above normal"], ["watch", "Watch"]];

export default function FiresPanel({ data, filter, onFilter, selectedId, onPick }) {
  const fires = data?.fires || [];
  const shown = filter === "all" ? fires : fires.filter(f => f.status === filter);
  return (
    <div className="fires">
      <div className="fires-filter">
        <Segmented options={FILTERS} value={filter} onChange={onFilter} full label="Filter fires" />
      </div>
      <ul className="fire-list">
        {shown.map(f => (
          <Fragment key={f.id}>
            <li className={f.id === selectedId ? "on" : ""}>
              <button type="button" onClick={() => onPick(f)} aria-expanded={f.id === selectedId}>
                <i className={`dot dot-${f.status}`} />
                <span className="f-name">{f.name}</span>
                <span className={`f-ratio num${f.status === "above" ? " up" : ""}`} title="This month against the 2001–2020 median around it">{ratio(f.ratio)}</span>
                <span className="f-meta">{f.region ? `${REGION_LABEL[f.region]} ` : ""}{f.country}, day {f.day}</span>
                <span className="f-n num">{num(f.detections)}</span>
              </button>
              {f.id === selectedId && <FireDetail fire={f} />}
            </li>
          </Fragment>
        ))}
      </ul>
      {data && shown.length === 0 && <p className="quiet pad">None in this group</p>}
    </div>
  );
}
