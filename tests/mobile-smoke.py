import os,json,pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
countries=json.loads((ROOT/'dist/assets/countries.geojson').read_text())['features']
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],proxy={'server':os.environ['HTTPS_PROXY'],'bypass':'127.0.0.1,localhost'} if os.environ.get('HTTPS_PROXY') else None)
 context=b.new_context(viewport={'width':448,'height':998},device_scale_factor=1,is_mobile=True,has_touch=True,service_workers='block')
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('WORLDSCOPE_TEST_URL','http://127.0.0.1:8080/'),wait_until='domcontentloaded')
 page.wait_for_function('typeof viewer !== "undefined" && viewer && viewer.imageryLayers.length >= 2 && typeof globeMode !== "undefined"',timeout=60000)
 page.wait_for_timeout(3000)
 assert not page.locator('#fatal').is_visible()
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 page.screenshot(path='/tmp/worldscope-aurora.png')
 before=page.evaluate('viewer.camera.positionCartographic.height')
 page.locator('#zoom-in').click();page.wait_for_timeout(100);intermediate=page.evaluate('viewer.camera.positionCartographic.height');assert before*.72 < intermediate < before;page.wait_for_timeout(700)
 after=page.evaluate('viewer.camera.positionCartographic.height');assert after<before*.9,(before,after)
 page.locator('[data-mode="atlas"].layer').click()
 page.wait_for_function('countryImagery && countryImagery.show && viewer.dataSourceDisplay.ready',timeout=60000);page.wait_for_timeout(1000)
 assert page.evaluate('countryLayer.entities.values.length')>=170
 page.evaluate("viewer.camera.setView({destination:C.Cartesian3.fromDegrees(44,33,19000000)})");page.wait_for_timeout(500);page.locator('#globe canvas').tap();page.wait_for_timeout(500)
 assert 'Iraq' in page.locator('#country-card').inner_text()
 page.screenshot(path='/tmp/worldscope-atlas.png')
 # Synthetic fixtures exercise the UI, never committed or displayed in production.
 def data_response(route):
  rows=[{'countryiso3code':f['properties']['iso3'],'date':'2024','value':(i+1)*100000} for i,f in enumerate(countries) if f['properties']['iso3']!='IRQ']
  route.fulfill(json=[{'pages':1,'lastupdated':'2026-01-01'},rows])
 page.route('https://api.worldbank.org/**',data_response)
 page.locator('[data-mode="insights"].layer').click()
 page.wait_for_function('metricData !== null',timeout=30000)
 assert page.locator('#data-year').input_value()=='2024'
 assert 'No reported data' in page.locator('#country-stat').inner_text()
 for metric in ['gdp','military','population']:
  page.locator('[data-metric="'+metric+'"]').click()
  page.wait_for_function('(metric)=> activeMetric === metric && metricData !== null',arg=metric)
  assert page.locator('#ranking-list li').count()==10
 page.locator('#ranking summary').click();page.locator('#ranking-list button').first.click()
 assert '2024' in page.locator('#country-stat').inner_text()
 page.wait_for_timeout(1000);page.screenshot(path='/tmp/worldscope-insights-fixture.png')
 page.locator('[data-mode="aurora"].layer').click()
 assert not page.locator('#insights').is_visible()
 assert not page.evaluate('countryImagery.show')
 page.locator('#explore-button').click();assert page.locator('.destination').count()==16
 page.locator('.destination').first.click();assert page.locator('#detail-panel').is_visible()
 page.locator('#save-place').click();assert page.locator('#save-place').get_attribute('aria-pressed')=='true'
 page.locator('#close-detail').click()
 # Failure must clear old colors and rankings when no cache is available.
 page.unroute('https://api.worldbank.org/**');page.route('https://api.worldbank.org/**',lambda route:route.abort())
 page.evaluate('localStorage.clear();dataMemory.clear()')
 page.locator('[data-mode="insights"].layer').click()
 page.wait_for_function("document.querySelector('#data-status').textContent.includes('unavailable')")
 assert page.locator('#data-legend').is_hidden()
 assert page.locator('#ranking').is_hidden()
 assert page.locator('#retry-data').is_visible()
 page.set_viewport_size({'width':412,'height':915})
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 page.set_viewport_size({'width':915,'height':412})
 assert page.locator('[data-mode="aurora"].layer').is_visible()
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 assert not errors,errors
 print('PASS: phone layout, Cesium startup, animated zoom, 177-country layer, country selection, three metric fixtures, ranking selection, saved places, and honest data failure; no page errors.')
 b.close()
