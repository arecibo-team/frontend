import { useState } from "react";
import Header from "./components/Header.jsx";
import MapPage from "./pages/MapPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import HelpPage from "./pages/HelpPage.jsx";
import MethodPage from "./pages/MethodPage.jsx";
import { api } from "./lib/api.js";
import { longDate } from "./lib/format.js";
import { DEFAULT_DATE, buildHash, navigate, replaceParams, useRoute } from "./lib/router.js";

function CopyLink() {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      window.prompt("Copy this link", window.location.href);
    }
  };
  return (
    <button className="btn" type="button" onClick={copy}>
      {done ? "Copied" : "Copy link"}
    </button>
  );
}

export default function App() {
  const { page, params: raw } = useRoute();
  const params = { ...raw, date: raw.date || DEFAULT_DATE };
  const shared = { date: params.date !== DEFAULT_DATE ? params.date : undefined, c: params.c };

  const setParams = patch => replaceParams(page, { ...raw, ...patch });
  const go = (next, extra = {}) => {
    const date = extra.date || params.date;
    navigate(next, { ...shared, ...extra, date: date !== DEFAULT_DATE ? date : undefined });
  };
  const linkFor = id => buildHash(id, id === "method" ? {} : shared);

  let right = <span className="replaying">Replaying {longDate(params.date)}</span>;
  if (page === "history") {
    right = (
      <>
        <a className="btn" href={api.historyCsvUrl(params.c || "GR", params.date)} download>
          Download CSV
        </a>
        <CopyLink />
      </>
    );
  }
  if (page === "method" || page === "help") right = null;

  const props = { params, setParams, go };
  return (
    <div className="app">
      <Header page={page} linkFor={linkFor} right={right} onSearch={page === "history" || page === "help" ? null : iso2 => go(page === "method" ? "map" : page, { c: iso2 })} />
      {page === "map" && <MapPage {...props} />}
      {page === "history" && <HistoryPage {...props} />}
      {page === "help" && <HelpPage {...props} />}
      {page === "method" && <MethodPage />}
    </div>
  );
}
