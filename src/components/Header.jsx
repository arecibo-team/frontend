import { useMemo, useState } from "react";
import { COUNTRY_NAMES } from "../lib/geo.js";

export function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M3 9.5a8 8 0 0 0 16 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M11 4v11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="11" cy="3.2" r="1.9" fill="currentColor" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Search({ onPick }) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return Object.entries(COUNTRY_NAMES)
      .filter(([iso2, name]) => name.toLowerCase().includes(q) || iso2.toLowerCase() === q)
      .slice(0, 6);
  }, [text]);

  const pick = iso2 => {
    onPick(iso2);
    setText("");
  };

  return (
    <div className="search">
      <SearchIcon />
      <input
        value={text}
        placeholder="Search"
        aria-label="Search for a country"
        onChange={e => {
          setText(e.target.value);
          setActive(0);
        }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") setActive(a => Math.min(a + 1, matches.length - 1));
          if (e.key === "ArrowUp") setActive(a => Math.max(a - 1, 0));
          if (e.key === "Enter" && matches[active]) pick(matches[active][0]);
          if (e.key === "Escape") setText("");
        }}
      />
      {matches.length > 0 && (
        <ul role="listbox">
          {matches.map(([iso2, name], i) => (
            <li key={iso2} role="option" aria-selected={i === active} onMouseDown={() => pick(iso2)}>
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
