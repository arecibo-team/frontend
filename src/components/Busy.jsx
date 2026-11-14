import { useEffect, useRef, useState } from "react";

export function useMinPending(active, minMs = 900) {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    if (active) {
      since.current = Date.now();
      setShown(true);
      return undefined;
    }
    if (!shown) return undefined;
    const left = Math.max(0, minMs - (Date.now() - since.current));
    const t = setTimeout(() => setShown(false), left);
    return () => clearTimeout(t);
  }, [active]);
  return shown;
}

export default function Busy({ show, title, steps = [] }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!show) return undefined;
    setStep(0);
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 320);
    return () => clearInterval(t);
  }, [show, steps.length]);
  if (!show) return null;
  return (
    <div className="busy-lock" role="alertdialog" aria-busy="true" aria-label={title}>
      <div className="busy-card">
        <div className="busy-ring" aria-hidden="true" />
        <div>
          <div className="busy-title">{title}</div>
          {steps.length > 0 && <div className="busy-step">{steps[step]}</div>}
          <div className="busy-bar"><i /></div>
        </div>
      </div>
    </div>
  );
}
