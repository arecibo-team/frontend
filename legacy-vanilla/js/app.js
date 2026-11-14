// Startup: build the map, layers, countries and wire the timeline.
(function () {
  const C = App.config;
  const D = App.dates;

  const map = App.initMap();
  App.initLayers(map);

  // ---- Timeline: year select + day slider + play ----------------------------
  const yearSel = document.getElementById("year");
  const day = document.getElementById("day");
  const label = document.getElementById("date-label");
  const play = document.getElementById("play");
  const latest = D.latest();
  const lastYear = +latest.slice(0, 4);

  for (let y = lastYear; y >= C.FIRST_YEAR; y--) yearSel.add(new Option(y, y));

  function syncSlider(iso) {
    const y = +iso.slice(0, 4);
    yearSel.value = y;
    day.max = y === lastYear ? D.dayOfYear(latest) : D.daysInYear(y);
    day.value = D.dayOfYear(iso);
    label.textContent = D.pretty(iso);
  }
  const sliderDate = () => D.fromDayOfYear(+yearSel.value, +day.value);

  function go(iso) {
    if (iso > latest) iso = latest;
    syncSlider(iso);
    App.setDate(iso);
  }

  yearSel.onchange = () => go(D.fromDayOfYear(+yearSel.value, Math.min(+day.value, D.daysInYear(+yearSel.value))));
  day.oninput = () => { label.textContent = D.pretty(sliderDate()); };   // cheap: label only while dragging
  day.onchange = () => go(sliderDate());                                // reload data on release

  let timer = null;
  play.onclick = () => {
    if (timer) { clearInterval(timer); timer = null; play.textContent = "▶"; return; }
    play.textContent = "❚❚";
    timer = setInterval(() => {
      if (+day.value >= +day.max) { play.click(); return; }
      day.value = +day.value + 1;
      go(sliderDate());
    }, 1200);
  };

  // No fire data yet → hide the timeline/legend strip and the year picker.
  if (!C.SHOW_FIRE_DATA) {
    document.querySelector(".strip").hidden = true;
    yearSel.closest(".field").hidden = true;
  }

  syncSlider(C.DEFAULT_DATE);
  App.setDate(C.DEFAULT_DATE);

  // ---- Countries (needed for selection and for the mock model) --------------
  App.initCountries(map)
    .then(n => {
      App.status(n + " countries loaded" + (C.SHOW_FIRE_DATA ? " · " + (C.PREDICTIONS_URL ? "model" : "mock model") : ""));
      return App.refreshPredictions();
    })
    .catch(err => App.status("Could not load borders: " + err.message));
})();
