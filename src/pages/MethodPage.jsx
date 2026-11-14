import { api } from "../lib/api.js";
import { useFetch } from "../lib/useFetch.js";

export default function MethodPage() {
  const { data } = useFetch(() => api.health(), []);
  const metrics = data?.cv_metrics || [];
  return (
    <main className="method">
      <h1>How Arecibo works</h1>
      <p>
        Arecibo puts two questions side by side for every EU country: how unusual is the burning right now, and how much
        firefighting power does the country still have to meet it. Everything on the map, the history and the plan comes from
        the same NASA FIRMS hotspot archive and a small set of public statistics.
      </p>

      <h2>One fire record from two satellites</h2>
      <p>
        FIRMS has hotspots from MODIS on Terra and Aqua since November 2000 and from VIIRS on Suomi NPP since January 2012.
        VIIRS has 375 m pixels against 1 km for MODIS, so it sees many more hotspots for the same fire. Counting raw hotspots
        would make every year after 2012 look worse than it was.
      </p>
      <p>
        We count activity in fire cell-days instead: a 0.01° cell, roughly 1 km, that has at least one hotspot on a day. Both
        sensors are put on that grid. For 2013 to 2022, when both flew, we fit the ratio between VIIRS and MODIS cell-days for
        every country and month, and pull small countries towards the EU ratio so a few quiet months do not produce wild values.
        MODIS months before 2012 are multiplied by that ratio. Before July 2002 only Terra was flying, so those months get one
        more correction for the missing Aqua passes.
      </p>
      <div className="formula">harmonized(country, month) = MODIS cell-days × ratio(country, calendar month)</div>
      <p>
        To check it we fit the ratios without one year at a time and compare the converted MODIS figure with what VIIRS really
        saw. The typical error for each country is shown under its calendar on the History page.
      </p>

      <h2>Is this normal</h2>
      <p>
        A month is compared with the median of the same calendar month from 2001 to 2020, on the harmonized scale. For a single
        fire we use the area around it, 5 by 5 tiles of half a degree, about 250 km across, so a fire in a usually quiet region
        stands out even if the country as a whole is having an average month. Fires above four times their median are marked
        above normal, those above twice are on watch.
      </p>

      <h2>Fires</h2>
      <p>
        Hotspots that touch each other on the same or the next day are joined into one fire. The fire takes the name of the
        largest town within about 12 km, or the nearest one, from GeoNames. Area is estimated from the number of distinct cells
        that burned.
      </p>

      <h2>Amber index and power</h2>
      <p>
        The Amber index measures the gap between what a country faces and what it has to face it with. Four pillars, each scaled
        from 0 to 1 across EU countries: fire danger, other hazards happening at the same time (floods, storms, earthquakes and
        volcanoes from GDACS), the professional workforce, and capability, meaning fire stations and fire protection spending.
        The weights come half from a gradient boosted model that predicts next year's burned share of land, and half from equal
        weights, so no single feature can dominate.
      </p>
      <div className="formula">power = 100 × readiness × (1 − 0.5 × hazard pressure)</div>
      <p>
        Power is the share of its fire service a country can still put on a new fire. It drops as the hazards it is already
        fighting use people and equipment. Green, Amber and Red bands follow the index at 40 and 60.
      </p>
      {metrics.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Validation</th>
              <th style={{ textAlign: "right" }}>Mean error</th>
              <th style={{ textAlign: "right" }}>Rank correlation</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => (
              <tr key={m.model + m.validation}>
                <td>{m.model}</td>
                <td>{m.validation}</td>
                <td className="num">{m.MAE.toFixed(3)}</td>
                <td className="num">{m.Spearman.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Who can help</h2>
      <p>
        The plan is a small mixed integer program. It decides how many firefighters each country sends to cover what the
        receiving country needs for the chosen scenario. Help goes in teams of 40, or as water bombers from countries that have
        them. The rules on the left of the page become constraints: a donor cannot fall below a power of 50 after sending, and
        countries fighting their own fires are skipped. Arrival time is the distance to the incident by road at about 80 km/h,
        or by air for countries with an aerial fleet.
      </p>

      <h2>Data</h2>
      <ul>
        <li>NASA FIRMS country archives, MODIS Collection 6.1 and VIIRS S-NPP 375 m, 2000 to 2025</li>
        <li>GDACS alerts for floods, storms, earthquakes, volcanoes and droughts</li>
        <li>Eurostat for firefighters, fire protection spending, population and land area</li>
        <li>OpenStreetMap fire stations through the Overpass API</li>
        <li>GWIS burned area through Our World in Data, used to train the index model</li>
        <li>GeoNames cities500 for fire names</li>
        <li>Natural Earth country shapes through world-atlas</li>
      </ul>
      <p className="small">
        We acknowledge the use of data and imagery from LANCE FIRMS operated by NASA's Earth Science Data and Information System
        (ESDIS) with funding provided by NASA Headquarters.
      </p>
    </main>
  );
}
