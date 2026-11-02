# WorldScope

A cinematic, mobile-friendly 3D Earth explorer built with vanilla JavaScript and CesiumJS. No build step, API keys, framework, or paid subscription is needed for the current personal-use configuration.

## Run

Serve `dist/` with any static web server. For example:

```sh
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. WebGL and internet access are required. Open `dist/index.html` through a server, not a file URL.

## Features

- Progressive satellite imagery down to city scale, with atmospheric scattering and an illustrative cloud shell.
- Real elevation geometry in Terrain mode; terrain flights approach at an angle.
- NASA VIIRS night imagery and Natural Earth country boundaries.
- Submit-to-search global location lookup through Wikipedia, with OpenStreetMap Nominatim fallback. No Nominatim autocomplete; requests are serialized at at least 1.1 second intervals.
- Tap place markers or map coordinates to discover nearby articles.
- Live Wikipedia summaries and history sections, Wikimedia images, and dated Wikidata population values where available.
- Sixteen featured destinations with bundled article summaries and images.
- Saved places stored on the device, layer controls, zoom, north reset, home view, and optional auto rotation.
- Responsive Android-oriented layout and installable web-app metadata. The service worker caches the same-origin app shell; external maps and articles require connectivity.

## Source layout

- `dist/index.html`: app shell and source credits
- `dist/styles.css`: responsive interface
- `dist/app.js`: Cesium engine, interactions, place lookup, persistence
- `dist/places.js`: sourced featured places
- `dist/assets/`: featured photographs, cloud texture, borders, icon
- `dist/sw.js`, `dist/manifest.webmanifest`: app installation and shell caching
- `prepare-places.py`: refresh featured Wikipedia summaries and photographs

## GitHub Pages

The included workflow deploys `dist/` from the main branch. After adding this project to a **new** GitHub repository, choose Settings → Pages → Source → GitHub Actions. No secrets are required. Do not copy `.openai/hosting.json` into an unrelated Sites project; it identifies the existing WorldScope deployment.

## Data and limits

CesiumJS 1.124.0 is pinned and served by jsDelivr. Satellite tiles and elevation come from Esri public services. Those images are **not open-source**; Esri and partner attribution is retained. Service access is verified during development but has no availability guarantee; check provider terms before large-scale or commercial use.

NASA GIBS VIIRS Black Marble is a **2016 composite**, approximately 500 m resolution. Night imagery is not live. Clouds are an illustrative historical NASA texture, not weather. Satellite image dates and maximum detail vary by location; the app cannot invent missing resolution. This version does not contain photogrammetry buildings, Street View, or live weather.

Natural Earth borders are approximate and not an authoritative statement about disputed boundaries. Place coverage depends on Wikipedia and OpenStreetMap. Population figures are shown with the recorded reference year and describe the article's geographic entity; they are not normalized metropolitan statistics. Public APIs can be rate-limited or unavailable.

## Attribution

App code: MIT. CesiumJS: Apache 2.0. Natural Earth: public domain. NASA imagery: NASA/GIBS. Cloud texture: NASA via https://github.com/turban/webgl-earth . Wikimedia photographs retain their own creator and license terms; the app links each originating article. Wikipedia text: CC BY-SA. OpenStreetMap: © OpenStreetMap contributors, ODbL. See `dist/ATTRIBUTIONS.json` for per-photo creator and license records.

## Validation

JavaScript syntax and bundled assets checked. Search, history retrieval, save/remove behavior, and responsive layout exercised through the browser. Cesium imagery, borders, and elevation providers are independently checked. Full 3D rendering and real Android performance require device validation: the supplied cloud browser has both WebGL and WebGL2 disabled.
