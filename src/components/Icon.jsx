const PATHS = {
  flame: "M8 14.5c2.5 0 4.5-1.8 4.5-4.3 0-2.6-2.2-4.2-2.8-6.7-.9 1.1-1.2 2.2-1.2 3.2C7.3 5.6 6.2 3.8 6.6 1.5 4.6 3 3.5 5.6 3.5 8.6c0 3.4 2 5.9 4.5 5.9z",
  area: "M2.5 5V2.5H5M11 2.5h2.5V5M13.5 11v2.5H11M5 13.5H2.5V11M6 8h4M8 6v4",
  pulse: "M1.5 8.5h3l1.8-4.5 3.2 9 1.8-4.5h3.2",
  help: "M8 13.8A5.8 5.8 0 1 0 8 2.2a5.8 5.8 0 0 0 0 11.6zM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3.9 3.9l2.3 2.3M9.8 9.8l2.3 2.3M12.1 3.9 9.8 6.2M6.2 9.8l-2.3 2.3",
  draw: "M2.5 2.5h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3M2.5 5.5v2M8 2.5h0M13.5 8v0M8 13.5h0",
  target: "M8 13.5A5.5 5.5 0 1 0 8 2.5a5.5 5.5 0 0 0 0 11zM8 1v3M8 12v3M1 8h3M12 8h3",
  book: "M2.5 3h4a2 2 0 0 1 2 2v8.5a1.5 1.5 0 0 0-1.5-1.5h-4.5zM13.5 3h-4a1 1 0 0 0-1 1M13.5 3v9h-4.5a1.5 1.5 0 0 0-.5.1",
  layers: "M8 2 1.5 5.5 8 9l6.5-3.5zM1.5 8.5 8 12l6.5-3.5M1.5 11.5 8 15l6.5-3.5",
  data: "M8 5.5c3 0 5.5-.9 5.5-2s-2.5-2-5.5-2-5.5.9-5.5 2 2.5 2 5.5 2zM2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2",
  link: "M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1"
};

export default function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="icon">
      <path d={PATHS[name]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
