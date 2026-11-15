import { api } from "../lib/api.js";
import { useFetch } from "../lib/useFetch.js";

export default function MethodPage() {
  const { data } = useFetch(() => api.health(), []);
  const metrics = data?.cv_metrics || [];
  return (
    <main className="method">
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
        The plan only deals with fires, and with the fires actually detected on the replay day. Each fire asks for a number
        of firefighters by its size so far: 50 under 200 detections, 500 from 200, 2,000 from 1,000. A unit, whether a
        region or a country, is sustainable when its fires ask for at most one sixth of its firefighters: one of three shifts is on
        duty, and half of it has to keep covering stations.
      </p>
      <p>Help is planned in three stages, and each stage only handles what the one before could not:</p>
      <ul>
        <li>Local: the region of each fire sends up to its sustainable sixth.</li>
        <li>National: the country's other regions send their spare crews, nearest first.</li>
        <li>
          European: what is still missing comes from other countries. A donor serves its own fires first, keeps half of its spare
          crews at home, and never ends up weaker than the country it helps. Among those, a mixed integer program picks the
          fastest arrivals in teams of at least 20.
        </li>
      </ul>
      <div className="formula">power = base power × (1 − firefighters asked for ÷ firefighters)</div>
      <p>
        The same formula is used for the map, the regions and the donors, so every firefighter that moves lowers the sender's
        power and raises the receiver's. Crews travel by road at 65 km/h after 2 hours to mobilise, or by air when that is
        faster: 6 hours to mobilise, 750 km/h, 2 hours to the fire. The fire load control multiplies what the receiving
        country's fires ask for, to test a worse day.
      </p>

      <h2>Firefighters by region</h2>
      <p>
        National firefighter numbers hide where the crews are. For 26 countries we use regional estimates of the national
        total in four parts: north, east, south and west. Each country is split by bearing from the centroid of its main land
        mass, so every fire and every detection falls in exactly one region. Austria's regional estimates add up to less
        than its national total, so we keep their proportions and scale them to it. Malta has no estimate.
      </p>
      <div className="formula">regional power = country power × clamp(firefighter share ÷ fire share, 0.4, 1.6)</div>
      <p>
        The fire share is the region's part of the country's harmonized detections this month. A region with a third of the
        fire and a tenth of the firefighters ends up well below its country. With fewer than 20 detections in the country the
        factor only reflects how many firefighters the region has. In a plan, help leaves from the donor's region closest to
        the fire.
      </p>

      <h2>Fuel and dryness</h2>
      <p>
        Land cover comes from CORINE 2018 (forest, shrub and grassland count as wildland fuel) and terrain from the
        Copernicus 90 m elevation model. Monthly soil moisture comes from ERA5-Land, greenness (NDVI) and land surface
        temperature from MODIS Terra, each as an anomaly against 2001–2020 for the same month, from January 2024 to October
        2026.
      </p>
      <div className="formula">dryness = mean(−topsoil moisture z, −root-zone moisture z, land heat z)</div>
      <p>
        Above 0.5 a place is drier than usual, above 1.5 much drier. Fuel risk multiplies the wildland fuel share by the
        chance that a normal month is wetter than this one. At a fire, weather for the hour of the last satellite pass comes
        from NASA POWER, or DWD ICON for the last few days.
      </p>

      <h2>Data</h2>
      <ul>
        <li>NASA FIRMS country archives, MODIS Collection 6.1 and VIIRS S-NPP 375 m, 2000 to 2025</li>
        <li>GDACS alerts for floods, storms, earthquakes, volcanoes and droughts</li>
        <li>Eurostat for firefighters, fire protection spending, population and land area</li>
        <li>OpenStreetMap fire stations through the Overpass API</li>
        <li>GWIS burned area through Our World in Data, used to train the index model</li>
        <li>GeoNames cities500 for fire names</li>
        <li>Regional firefighter estimates for 26 EU countries, 2025 (Slovenia 2010–2024, Ireland 2024)</li>
        <li>CORINE Land Cover 2018, Copernicus DEM GLO-90, ERA5-Land soil moisture, MODIS NDVI and land surface temperature</li>
        <li>NASA POWER and DWD ICON fire weather, GDACS live alerts</li>
        <li>Natural Earth 1:10m country shapes</li>
      </ul>
      <p className="small">
        We acknowledge the use of data and imagery from LANCE FIRMS operated by NASA's Earth Science Data and Information System
        (ESDIS) with funding provided by NASA Headquarters.
      </p>
    </main>
  );
}
