import { displayName } from "../lib/countries.js";

// Right-hand panel: just the selected country's name.
export default function CountryPanel({ selected }) {
  return (
    <aside className="panel" aria-live="polite">
      {selected ? <h2>{displayName(selected)}</h2> : <p className="empty">Click a country on the map</p>}
    </aside>
  );
}
