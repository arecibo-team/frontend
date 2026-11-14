import { useEffect, useState } from "react";

function Icon({ d }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const EXPAND = "M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9";
const CLOSE = "M3.5 3.5l9 9M12.5 3.5l-9 9";

export function Dialog({ title, onClose, children, wide = true, actions }) {
  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`dialog${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <h2 className="h2">{title}</h2>
          <div className="dialog-actions">
            {actions}
            <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
              <Icon d={CLOSE} />
            </button>
          </div>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}

export default function Sidebar({ side, title, sub, onClose, children, width }) {
  const [open, setOpen] = useState(false);
  const body = typeof children === "function" ? children : () => children;
  return (
    <>
      <aside className={`sidebar sidebar-${side}`} style={width ? { width } : undefined}>
        <div className="sidebar-head">
          <div className="sidebar-title">
            <h2 className="h2">{title}</h2>
            {sub && <div className="small">{sub}</div>}
          </div>
          <button className="icon-btn" type="button" onClick={() => setOpen(true)} aria-label="Open in a dialog" title="Open in a dialog">
            <Icon d={EXPAND} />
          </button>
          {onClose && (
            <button className="icon-btn" type="button" onClick={onClose} aria-label="Close" title="Close">
              <Icon d={CLOSE} />
            </button>
          )}
        </div>
        <div className="sidebar-body">{body(false)}</div>
      </aside>
      {open && (
        <Dialog title={title} onClose={() => setOpen(false)}>
          {body(true)}
        </Dialog>
      )}
    </>
  );
}
