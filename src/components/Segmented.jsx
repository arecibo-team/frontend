export default function Segmented({ options, value, onChange, full = false, label }) {
  return (
    <div className={`seg${full ? " full" : ""}`} role="group" aria-label={label}>
      {options.map(([id, text, disabled, hint]) => (
        <button
          key={id}
          type="button"
          className={value === id ? "on" : ""}
          aria-pressed={value === id}
          disabled={disabled}
          title={hint}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
