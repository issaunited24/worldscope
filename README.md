# WorldScope

A phone-first Earth explorer designed for touch use on the Pixel 9 Pro XL. Vanilla JavaScript and CesiumJS 1.124.0; no build step or API keys. One phone interface supports portrait and landscape. There is no separate desktop layout.

## Run

```sh
python3 -m http.server 8080 --directory dist
```

Serve `dist/` over HTTP locally or HTTPS when hosted. WebGL is required. The existing GitHub Actions workflow publishes `dist/` to GitHub Pages when changes reach `main`. Local edits do not publish automatically. `.openai/hosting.json` identifies an existing hosting project; do not reuse it in an unrelated deployment.

## Explore

- **Aurora:** realistic imagery, restrained atmosphere, optional clouds, saved places and location search. Settings retain terrain and dated NASA night imagery.
- **Atlas:** country borders, labels at closer scales, and tap-to-select countries.
- **Insights:** population, total GDP in current US dollars, and military expenditure in current US dollars. Select a reporting year, inspect a country, or select a top-ten entry.
- Animated zoom buttons, touch inertia, bounded rendering resolution, reduced detail during camera movement, and a 60 fps target. Reduced-motion preferences are respected. Actual frame rate depends on the phone, thermal conditions and imagery loading.

A bundled Natural Earth overview map keeps the globe recognizable when Esri satellite imagery is unavailable. It is an overview map, not detailed or live satellite imagery. Country overlays use a single geographic texture to avoid expensive country polygon triangulation on mobile.

## Statistical sources and comparison rules

Data is requested directly from the World Bank WDI API, using `SP.POP.TOTL`, `NY.GDP.MKTP.CD` and `MS.MIL.XPND.CD`. The military expenditure series is sourced from SIPRI. Spending is not a measure of overall military strength; GDP is not GDP per capita or purchasing-power adjusted.

The app queries the current calendar year and previous five years. It defaults to the newest year with at least 80 mapped countries reporting, and offers other broadly covered years. All colors and rankings use the selected year. Countries without figures remain gray, with no guessed or substituted values. The color scale is logarithmic so differences remain visible across very different country sizes. Tapping a country shows the unrounded-to-millions value, units and reference year.

Each metric shows its source link, retrieval date and provider update date when available. Failed live requests may use previously retrieved data, explicitly labeled cached with its original retrieval date and a retry control. Without valid cached data, the app reports unavailability and clears figures, colors and rankings. Test fixtures are not production data.

Natural Earth 1:110m boundaries cover 177 geographic features and omit some small countries. Rankings describe mapped countries with data, not all countries worldwide. Boundaries are approximate and can be disputed. See `dist/assets/SOURCES.json` for dataset provenance.

## Network requirements

Cesium engine: `cdn.jsdelivr.net` (fallback `cesium.com`). Maps: `services.arcgisonline.com`, `elevation3d.arcgis.com`, `gibs.earthdata.nasa.gov`. Country statistics: `api.worldbank.org`. Place information: `en.wikipedia.org`, `www.wikidata.org`, `upload.wikimedia.org`, `nominatim.openstreetmap.org`.

External maps and statistics require connectivity. The service worker caches same-origin resources; it does not promise offline availability of external services. No API credentials are required.

## Validation

```sh
node --check dist/app.js
node --check dist/insights-data.js
node --check dist/sw.js
node --test tests/insights-data.test.cjs
# With the local server running, Python Playwright and /usr/bin/chromium installed:
python3 tests/mobile-smoke.py
```

The browser check exercises real Cesium rendering, eased zoom, country overlays and touch selection, the three statistical layers with explicitly synthetic API responses, rankings, saved places, and network-failure states. It respects HTTPS_PROXY when present. Optional `WORLDSCOPE_TEST_URL` selects another test server. Screenshots are written under `/tmp`; the Insights screenshot contains synthetic test values and is not a factual data preview.

Development-environment policy currently blocks the live Esri, encyclopedia and World Bank endpoints. Real API responses and on-device Pixel frame rate have not been validated here. Geometry, fallback map, UI, parsing and error handling can be validated independently. Apply the saved network requirements before live-service checks.

## Source layout

- `dist/app.js`: Cesium controls, modes, country overlays and place discovery.
- `dist/insights-data.js`: data validation, year selection, ranking, geographic picking and number formatting.
- `dist/index.html`, `dist/styles.css`: phone interface.
- `dist/assets/countries.geojson`, `dist/assets/earth/`: country geometry and fallback overview tiles.
- `dist/places.js`, other `dist/assets/`: bundled featured destinations and photographs.
- `prepare-places.py`, `prepare-credits.py`: optional refresh scripts that modify bundled content; not startup steps.

## Attribution

Code: MIT. CesiumJS: Apache 2.0. Natural Earth: public domain. Esri imagery and elevation retain provider attribution and are subject to provider terms. NASA GIBS night imagery is a **2016** VIIRS composite, not live. Clouds are a historical NASA illustration via WebGL Earth, not weather. Wikipedia text: CC BY-SA. Wikimedia photos retain their respective licenses in `dist/ATTRIBUTIONS.json`. OpenStreetMap: © OpenStreetMap contributors, ODbL. Statistical provider links and years appear in Insights.
