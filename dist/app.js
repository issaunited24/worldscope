/* WorldScope · Vanilla JavaScript + CesiumJS. No keys or paid API dependencies. */
'use strict';
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const icons = {
 globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',bookmark:'<path d="M6 4h12v17l-6-4-6 4Z"/>',
 shuffle:'<path d="M3 7h3c4 0 6 10 10 10h5m-4-4 4 4-4 4M3 17h3c2 0 3-3 4-5m3-3c1-2 2-2 4-2h4m-4-4 4 4-4 4"/>',
 sliders:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
 rotate:'<path d="M20 9a8 8 0 1 0 0 6M20 4v5h-5"/>',move:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
 pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',external:'<path d="M14 4h6v6m0-6L10 14M10 4H4v16h16v-6"/>',check:'<path d="m5 12 4 4L19 6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.pin}</svg>`;
function hydrateIcons(root = document){ $$('[data-icon]',root).forEach(el=>el.innerHTML=icon(el.dataset.icon)); }
function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const places = window.WORLDSCOPE_PLACES || [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let viewer, C, clouds, borders, nightLayer, terrainProvider, selected, viewMode='satellite', filter='all', savedMode=false, rotating=false, detailGeneration=0, searchGeneration=0, pickGeneration=0, lastNominatim=0, toastTimer;
let saved=[];
try { const data=JSON.parse(localStorage.getItem('worldscope.saved.v1')||'[]'); if(Array.isArray(data))saved=data.filter(p=>p&&typeof p.name==='string'&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)); }catch{}
const cache=new Map(), markers=[];
const coords=(lat,lon)=>`${Math.abs(lat).toFixed(2)}° ${lat>=0?'N':'S'}  ${Math.abs(lon).toFixed(2)}° ${lon>=0?'E':'W'}`;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function announce(message){$('#sr-status').textContent=message;}
async function json(url,timeout=12000){const controller=new AbortController(),id=setTimeout(()=>controller.abort(),timeout);try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw new Error(`Service returned ${r.status}`);const j=await r.json();if(j.error)throw new Error(j.error.info||j.error.message||'Data unavailable');return j;}finally{clearTimeout(id);}}
function wiki(params){return json('https://en.wikipedia.org/w/api.php?'+new URLSearchParams({origin:'*',format:'json',formatversion:'2',...params}));}
async function nominatim(params){const delay=Math.max(0,1100-(Date.now()-lastNominatim));lastNominatim=Date.now()+delay;if(delay)await new Promise(r=>setTimeout(r,delay));return json('https://nominatim.openstreetmap.org/'+params.path+'?'+new URLSearchParams({format:'jsonv2',...params.args}));}
function renderPlaces(){const list=(savedMode?saved:places).filter(p=>filter==='all'||p.category===filter);$('#collection-title').textContent=savedMode?'Your corner of the world':'Discover the extraordinary';$('#place-count').textContent=String(list.length).padStart(2,'0')+' PLACES';$('#saved-dot').hidden=saved.length===0;$('#destination-list').innerHTML=list.length?list.map(p=>`<button class="destination" data-place="${esc(p.id)}" aria-label="Explore ${esc(p.name)}">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`:''}<span class="tag">${esc(p.tag||'SAVED DISCOVERY')}</span><span class="card-copy"><h3>${esc(p.name)}</h3><span class="subline">${icon('pin')}${esc(p.country||p.description||'Explore this place')}</span></span><span class="card-arrow">${icon('arrow')}</span></button>`).join(''):`<div class="empty-list">${savedMode?'Your discoveries belong here.<br>Open a place and tap Save to keep it.':'No places in this collection yet.'}</div>`;$$('[data-place]').forEach(el=>el.onclick=()=>openPlace(list.find(p=>p.id===el.dataset.place)));$$('.destination img').forEach(img=>img.onerror=()=>img.remove());}
function setDiscoveryOpen(open){
  $('#discovery').classList.toggle('collapsed',!open);
  for(const [id,active] of [['explore-button',open&&!savedMode],['saved-button',open&&savedMode]]){
    const button=$('#'+id);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-expanded',String(active));
  }
}
function setCollection(isSaved){savedMode=isSaved;filter='all';$$('[data-filter]').forEach(el=>el.classList.toggle('active',el.dataset.filter==='all'));renderPlaces();setDiscoveryOpen(true);}
function stopRotation(){rotating=false;$('#rotate-button').setAttribute('aria-pressed','false');$('#rotate-button').setAttribute('aria-label','Start automatic rotation');}
function fly(place,close=false){if(!viewer)return;stopRotation();if(close)closeDetail();const height=place.height||35000;if(viewMode==='terrain'){viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(place.lon,place.lat),100),{offset:new C.HeadingPitchRange(0,C.Math.toRadians(-50),height*1.35),duration:reducedMotion?0:2.7});}else{viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(place.lon,place.lat,height),orientation:{heading:0,pitch:C.Math.toRadians(-90),roll:0},duration:reducedMotion?0:2.7});}announce(`Flying to ${place.name}`);}
function home(){if(!viewer)return;closeDetail();stopRotation();viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(30,22,19000000),orientation:{heading:0,pitch:-Math.PI/2,roll:0},duration:reducedMotion?0:2.2});}
function closeDetail(){detailGeneration++;$('#detail-panel').hidden=true;document.body.classList.remove('details-open');selected=null;}
function toggleSave(place){const idx=saved.findIndex(p=>p.id===place.id);if(idx>=0)saved.splice(idx,1);else saved.push({...place});try{localStorage.setItem('worldscope.saved.v1',JSON.stringify(saved));}catch{toast('Device storage is unavailable. Saved for this session.');}updateSaveButton(place);renderPlaces();announce(idx>=0?'Place removed from saved places':'Place saved');}
function updateSaveButton(place){const b=$('#save-place');if(b){const yes=saved.some(p=>p.id===place.id);b.innerHTML=icon(yes?'check':'bookmark')+(yes?'Saved':'Save');b.setAttribute('aria-pressed',String(yes));}}
async function population(qid){if(!qid)return null;const j=await json('https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',ids:qid,props:'claims',format:'json',origin:'*'}));const claims=j.entities?.[qid]?.claims?.P1082||[];const rows=claims.filter(x=>x.rank!=='deprecated'&&x.mainsnak?.datavalue?.value?.amount).map(x=>({amount:Number(x.mainsnak.datavalue.value.amount),date:x.qualifiers?.P585?.[0]?.datavalue?.value?.time,rank:x.rank}));rows.sort((a,b)=>(b.date||'').localeCompare(a.date||''));return rows[0]||null;}
async function openPlace(place,{flight=true}={}){if(!place)return;setDiscoveryOpen(false);const gen=++detailGeneration;selected=place;$('#search-results').hidden=true;document.body.classList.add('details-open');const panel=$('#detail-panel');panel.hidden=false;panel.scrollTop=0;panel.innerHTML=`<div class="detail-hero">${place.image?`<img src="${esc(place.image)}" alt="${esc(place.name)}">`:''}<button class="close-button" id="close-detail" aria-label="Close place details">×</button></div><div class="detail-content"><span class="eyebrow mint">${esc(place.tag||'A NEW PERSPECTIVE')}</span><h2>${esc(place.name)}</h2><div class="detail-sub">${esc(place.country||place.description||'Discover this location')}</div><div class="detail-actions"><button class="primary" id="fly-place">${icon('compass')} Take a closer look</button><button class="secondary" id="save-place"></button></div><div class="facts"><div class="fact"><small>Latitude</small><strong>${Math.abs(place.lat).toFixed(4)}° ${place.lat>=0?'N':'S'}</strong></div><div class="fact"><small>Longitude</small><strong>${Math.abs(place.lon).toFixed(4)}° ${place.lon>=0?'E':'W'}</strong></div></div><div id="population-fact"></div><div class="detail-tabs"><button class="active" id="overview-tab">Overview</button><button id="history-tab">History & stories</button></div><div id="place-story"><p>${esc(place.summary||'Finding the story behind this place…')}</p></div><a id="wiki-source" class="source-link" href="${esc(place.source||'https://en.wikipedia.org/wiki/'+encodeURIComponent(place.wiki||place.name))}" target="_blank" rel="noopener">Explore the full story on Wikipedia ${icon('external')}</a><a class="photo-credit" id="photo-source" href="${esc(place.photoSource||place.source||'https://commons.wikimedia.org/')}" target="_blank" rel="noopener">${place.image?esc(place.photoCredit||'Photo: Wikimedia · View creator & license'):'Information: Wikipedia / Wikimedia · CC BY-SA'}</a></div>`;$('#close-detail').onclick=closeDetail;$('#fly-place').onclick=()=>fly({...place,height:Math.max(1800,(place.height||35000)*.35)});$('#save-place').onclick=()=>toggleSave(place);updateSaveButton(place);const img=$('.detail-hero img');if(img)img.onerror=()=>img.remove();if(flight)fly(place);if(!place.wiki){$('#wiki-source').innerHTML='View this place on OpenStreetMap '+icon('external');$('#photo-source').textContent='Map data: © OpenStreetMap contributors';$('#history-tab').hidden=true;$('#overview-tab').onclick=()=>{};return;}let summary=place.summary;let historyText=null;
$('#overview-tab').onclick=()=>{$('#overview-tab').classList.add('active');$('#history-tab').classList.remove('active');$('#place-story').innerHTML=`<p>${esc(summary||'No article summary is available. Use the source link to explore further.')}</p>`;};
$('#history-tab').onclick=async()=>{$('#history-tab').classList.add('active');$('#overview-tab').classList.remove('active');$('#place-story').innerHTML='<p>Opening the history of this place…</p>';try{if(!historyText){const sections=await wiki({action:'parse',page:place.wiki||place.name,prop:'sections'});const section=sections.parse?.sections?.find(s=>/history|historical|geology|formation|background|archaeology/i.test(s.line));if(!section)historyText='A separate history section is not available for this place. The full article below has more context.';else{const response=await wiki({action:'parse',page:place.wiki||place.name,prop:'text',section:section.index,disableeditsection:'1'});const doc=new DOMParser().parseFromString(response.parse.text,'text/html');doc.querySelectorAll('table,style,script,sup,.hatnote,.mw-editsection,figure,.thumb').forEach(x=>x.remove());const paragraphs=[...doc.querySelectorAll('p')].map(x=>x.textContent.trim()).filter(x=>x.length>90);historyText=paragraphs.slice(0,4).join('\n\n').slice(0,2500)||'Read the full article for the history of this place.';}}if(gen===detailGeneration&&$('#history-tab')?.classList.contains('active'))$('#place-story').innerHTML=historyText.split('\n\n').map(p=>`<p>${esc(p)}</p>`).join('');}catch{if(gen===detailGeneration)$('#place-story').innerHTML='<p>The history service is unavailable right now. You can still open the full article below.</p>';}};
try{let data=cache.get('summary:'+place.wiki);if(!data){data=await json('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent((place.wiki||place.name).replaceAll(' ','_')));cache.set('summary:'+place.wiki,data);}if(gen!==detailGeneration)return;summary=data.extract||summary;place.summary=summary;if($('#overview-tab').classList.contains('active'))$('#place-story').innerHTML=`<p>${esc(summary||'No summary is available for this location.')}</p>`;if(!place.image&&data.thumbnail?.source){place.image=data.thumbnail.source;const image=document.createElement('img');image.src=place.image;image.alt=place.name;image.onerror=()=>image.remove();$('.detail-hero').prepend(image);$('#photo-source').textContent='Photo: Wikimedia · View original article for creator & license';}const pop=await population(data.wikibase_item||place.wikibase);if(gen!==detailGeneration)return;if(pop){const year=pop.date?.match(/[+-](\d{4})/)?.[1];$('#population-fact').innerHTML=`<div class="facts"><div class="fact"><small>Recorded population</small><strong>${pop.amount.toLocaleString()}</strong></div><div class="fact"><small>${year?'Reference year':'Source'}</small><strong>${esc(year||'Wikidata')}</strong></div></div><p class="api-note">Wikidata figure for this article's geographic entity; boundaries and census dates vary.</p>`;}}catch{if(gen!==detailGeneration)return;if(!summary)$('#place-story').innerHTML='<p>Live information is unavailable right now. You can still explore the map and open the source article.</p>';else $('#place-story').insertAdjacentHTML('beforeend','<p class="api-note">Showing the saved article summary. Live updates are unavailable.</p>');}}
function pageToPlace(page){const co=page.coordinates?.[0];if(!co)return null;return {id:'wiki-'+page.pageid,name:page.title,wiki:page.title,lat:co.lat,lon:co.lon,height:250000,description:page.description||'Wikipedia location',summary:page.extract,image:page.thumbnail?.source,wikibase:page.pageprops?.wikibase_item,source:'https://en.wikipedia.org/?curid='+page.pageid,category:'place'};}
async function searchPlaces(query){const local=places.filter(p=>(p.name+' '+p.country+' '+p.wiki).toLowerCase().includes(query.toLowerCase()));let remote=[];try{const r=await wiki({action:'query',generator:'search',gsrsearch:query,gsrnamespace:'0',gsrlimit:'12',prop:'coordinates|pageimages|extracts|description|pageprops',coprimary:'primary',piprop:'thumbnail',pithumbsize:'600',exintro:'1',explaintext:'1',exsentences:'4'});remote=(r.query?.pages||[]).sort((a,b)=>a.index-b.index).map(pageToPlace).filter(Boolean);}catch{}const combined=[...local,...remote.filter(p=>!local.some(l=>l.wiki===p.wiki))];if(combined.length)return combined;const osm=await nominatim({path:'search',args:{q:query,limit:'7',addressdetails:'1'}});return osm.map(p=>({id:'osm-'+p.osm_type+'-'+p.osm_id,name:p.name||p.display_name.split(',')[0],wiki:null,summary:'This place is mapped by OpenStreetMap. An encyclopedia article is not linked to this result.',lat:Number(p.lat),lon:Number(p.lon),height:p.addresstype==='country'?2500000:30000,description:p.display_name,country:p.address?.country,source:'https://www.openstreetmap.org/'+p.osm_type+'/'+p.osm_id,category:'place'}));}
async function doSearch(event){event?.preventDefault();const query=$('#search-input').value.trim();if(!query)return;const gen=++searchGeneration;const container=$('#search-results');container.hidden=false;container.innerHTML='<div class="search-message">Searching the world…</div>';try{const results=cache.get('search:'+query)||await searchPlaces(query);cache.set('search:'+query,results);if(gen!==searchGeneration)return;container.innerHTML=results.length?results.slice(0,8).map((p,i)=>`<button class="search-result" type="button" data-result="${i}">${icon('pin')}<span><b>${esc(p.name)}</b><small>${esc(p.country||p.description||coords(p.lat,p.lon))}</small></span></button>`).join(''):'<div class="search-message">No mapped places found. Try adding a country or a nearby city.</div>';$$('[data-result]',container).forEach(el=>el.onclick=()=>{openPlace(results[Number(el.dataset.result)]);$('#search-input').blur();});announce(`${results.length} places found`);}catch{if(gen===searchGeneration)container.innerHTML='<div class="search-message">Search is temporarily unavailable. Try again, or explore a featured place.</div>';}}
async function resolveTap(lat,lon){const gen=++pickGeneration;toast('Discovering this part of the world…');try{const nearby=await wiki({action:'query',generator:'geosearch',ggscoord:lat+'|'+lon,ggsradius:'10000',ggslimit:'5',prop:'coordinates|pageimages|extracts|description',piprop:'thumbnail',pithumbsize:'600',exintro:'1',explaintext:'1',exsentences:'5'});if(gen!==pickGeneration)return;const found=(nearby.query?.pages||[]).map(pageToPlace).filter(Boolean);found.sort((a,b)=>(a.lat-lat)**2+(a.lon-lon)**2-((b.lat-lat)**2+(b.lon-lon)**2));if(found[0]){openPlace(found[0],{flight:false});$('#toast').hidden=true;return;}const reverse=await nominatim({path:'reverse',args:{lat,lon,zoom:viewer.camera.positionCartographic.height>1000000?'3':'10',addressdetails:'1'}});if(gen!==pickGeneration)return;const name=reverse.name||reverse.address?.city||reverse.address?.state||reverse.address?.country;if(!name){toast('Open water or an unmapped area. Try a nearby landmark or city.');return;}const results=await searchPlaces(name);if(gen!==pickGeneration)return;if(results[0]){openPlace(results[0],{flight:false});$('#toast').hidden=true;}else toast('No place article is mapped here. Try a nearby town.');}catch{if(gen===pickGeneration)toast('Place lookup is unavailable here. Try searching a name.');}}
async function setLayer(mode){if(!viewer)return;const previous=viewMode;viewMode=mode;$$('[data-layer]').forEach(b=>{b.classList.toggle('active',b.dataset.layer===mode);b.setAttribute('aria-pressed',String(b.dataset.layer===mode));});$('#view-status').textContent=({satellite:'SATELLITE VIEW',terrain:'3D TERRAIN',borders:'COUNTRY BORDERS',night:'NIGHT LIGHTS · 2016'})[mode];if(nightLayer)nightLayer.show=mode==='night';if(borders)borders.show=mode==='borders';viewer.scene.globe.enableLighting=false;
if(mode==='night'){if(!nightLayer){nightLayer=viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',maximumLevel:8,credit:'NASA GIBS · VIIRS Black Marble (2016)'}));let reported=false;nightLayer.imageryProvider.errorEvent.addEventListener(()=>{if(!reported&&viewMode==='night'){reported=true;toast('Some night tiles could not load. Try again shortly.');}});}toast('NASA night lights · 2016 composite · ~500 m detail');}
if(mode==='borders'&&!borders){try{const data=await C.GeoJsonDataSource.load('./assets/borders.geojson',{stroke:C.Color.fromCssColorString('#9ee9ca').withAlpha(.8),strokeWidth:1.4,clampToGround:true});borders=await viewer.dataSources.add(data);borders.show=viewMode==='borders';}catch{toast('The border layer could not load. Satellite imagery is still available.');}}
if(mode==='terrain'){toast('Loading real elevation. Zoom into mountains to explore.');try{if(!terrainProvider)terrainProvider=await C.ArcGISTiledElevationTerrainProvider.fromUrl('https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer');if(viewMode==='terrain'){viewer.terrainProvider=terrainProvider;viewer.scene.globe.enableLighting=true;viewer.scene.light=new C.DirectionalLight({direction:new C.Cartesian3(-.3,-.6,-.8),intensity:2});toast('Real 3D terrain ready. Two-finger drag to tilt.');}}catch{if(viewMode==='terrain'){toast('Elevation is unavailable. Satellite mode is still working.');setLayer(previous==='terrain'?'satellite':previous);}}}else viewer.terrainProvider=new C.EllipsoidTerrainProvider();viewer.scene.requestRender();}
async function initGlobe(){try{if(!window.Cesium)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cesium.com/downloads/cesiumjs/releases/1.124/Build/Cesium/Cesium.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});C=window.Cesium;C.Ion.defaultAccessToken='';viewer=new C.Viewer('globe',{baseLayer:false,terrainProvider:new C.EllipsoidTerrainProvider(),animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,shouldAnimate:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,contextOptions:{webgl:{alpha:false,antialias:true,powerPreference:'high-performance'}}});viewer.resolutionScale=1.15;viewer.scene.backgroundColor=C.Color.fromCssColorString('#05090e');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#102a3b');viewer.scene.globe.maximumScreenSpaceError=3;viewer.scene.globe.tileCacheSize=200;viewer.scene.globe.showGroundAtmosphere=false;viewer.scene.globe.enableLighting=false;viewer.scene.skyAtmosphere.show=true;viewer.scene.skyAtmosphere.brightnessShift=.03;viewer.scene.skyBox.show=false;viewer.scene.skyAtmosphere.hueShift=.03;viewer.scene.skyAtmosphere.saturationShift=.15;viewer.scene.globe.atmosphereLightIntensity=8;viewer.scene.fog.enabled=true;viewer.scene.screenSpaceCameraController.minimumZoomDistance=120;viewer.scene.screenSpaceCameraController.maximumZoomDistance=42000000;viewer.scene.screenSpaceCameraController.enableCollisionDetection=true;viewer.scene.postProcessStages.fxaa.enabled=true;viewer.targetFrameRate=60;const controls=viewer.scene.screenSpaceCameraController;controls.inertiaSpin=.92;controls.inertiaZoom=.85;controls.inertiaTranslate=.9;controls.maximumMovementRatio=.08;viewer.camera.moveStart.addEventListener(()=>applyQuality(true));viewer.camera.moveEnd.addEventListener(()=>applyQuality(false));
viewer.imageryLayers.addImageryProvider(await C.TileMapServiceImageryProvider.fromUrl('./assets/earth/',{maximumLevel:2,credit:'Natural Earth · public domain · overview map'}));
const base=viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maximumLevel:19,credit:'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community'}));base.brightness=.92;base.contrast=1.12;base.saturation=1.12;let tileError=false;base.imageryProvider.errorEvent.addEventListener(()=>{if(!tileError){tileError=true;toast('Detailed imagery is unavailable. Showing the Natural Earth overview.');}});
viewer.camera.setView({destination:C.Cartesian3.fromDegrees(30,22,19000000),orientation:{heading:0,pitch:-Math.PI/2,roll:0}});
clouds=viewer.entities.add({name:'Illustrative cloud cover',position:C.Cartesian3.ZERO,ellipsoid:{radii:new C.Cartesian3(6418137,6418137,6396752),material:new C.ImageMaterialProperty({image:'./assets/clouds.webp',transparent:true,color:C.Color.WHITE.withAlpha(.65)}),slicePartitions:64,stackPartitions:32}});
for(const place of places){const entity=viewer.entities.add({id:'place-'+place.id,name:place.name,position:C.Cartesian3.fromDegrees(place.lon,place.lat),point:{pixelSize:6,color:C.Color.fromCssColorString('#b7f0d6'),outlineColor:C.Color.fromCssColorString('#163e37'),outlineWidth:2,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:0},label:{text:place.name,font:'11px sans-serif',fillColor:C.Color.fromCssColorString('#d3e8e1'),outlineColor:C.Color.fromCssColorString('#071519'),outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-16),heightReference:C.HeightReference.CLAMP_TO_GROUND,scaleByDistance:new C.NearFarScalar(100000,1,20000000,.8),distanceDisplayCondition:new C.DistanceDisplayCondition(0,26000000)}});entity.worldscopePlace=place;markers.push(entity);}
viewer.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);viewer.screenSpaceEventHandler.setInputAction(e=>{const picked=viewer.scene.pick(e.position);if(picked?.id?.worldscopeCountry){selectCountry(picked.id.worldscopeCountry);return;}if(picked?.id?.worldscopePlace){pickGeneration++;openPlace(picked.id.worldscopePlace);return;}const ray=viewer.camera.getPickRay(e.position);const point=viewer.scene.globe.pick(ray,viewer.scene);if(point){const c=C.Cartographic.fromCartesian(point);if(globeMode!=='aurora'){const f=findCountry(C.Math.toDegrees(c.longitude),C.Math.toDegrees(c.latitude));if(f)selectCountry(f.properties.iso3);}else resolveTap(C.Math.toDegrees(c.latitude),C.Math.toDegrees(c.longitude));}},C.ScreenSpaceEventType.LEFT_CLICK);
const start=Date.now();let lastFrame=performance.now(),lastTelemetry=0;
viewer.scene.postRender.addEventListener(()=>{const now=performance.now(),dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;if(rotating){viewer.camera.rotate(C.Cartesian3.UNIT_Z,-dt*.025);viewer.scene.requestRender();}const height=viewer.camera.positionCartographic.height;clouds.show=globeMode==='aurora'&&$('#clouds-toggle').checked&&height>2200000&&viewMode!=='night';if(now-lastTelemetry>150){lastTelemetry=now;const p=viewer.camera.positionCartographic;$('#coordinates').textContent=coords(C.Math.toDegrees(p.latitude),C.Math.toDegrees(p.longitude));$('#altitude').textContent=height>=1000?Math.round(height/1000).toLocaleString()+' KM':Math.round(height)+' M';}if(viewer.scene.globe.tilesLoaded||Date.now()-start>14000)$('#loading').hidden=true;});
viewer.scene.globe.tileLoadProgressEvent.addEventListener(n=>{if(n===0)$('#loading').hidden=true;});viewer.canvas.addEventListener('pointerdown',()=>{viewer.camera.cancelFlight();stopRotation();$('#globe-hint').style.opacity='0';$('#search-results').hidden=true;});viewer.canvas.addEventListener('wheel',()=>stopRotation(),{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRotation();});viewer.scene.renderError.addEventListener((_scene,error)=>{console.error('WorldScope render error',error);$('#fatal-message').textContent='Your graphics session was interrupted. Reload to reconnect to Earth.';$('#fatal').hidden=false;});setTimeout(()=>{$('#loading').hidden=true;},15000);
}catch(error){console.error('WorldScope initialization failed',error);$('#loading').hidden=true;$('#fatal-message').textContent='The 3D engine could not start. Check your connection and WebGL support, then reload.';$('#fatal').hidden=false;}}
function bind(){hydrateIcons();renderPlaces();$('#search-form').onsubmit=doSearch;$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderPlaces();});$('#explore-button').onclick=()=>{const open=!$('#discovery').classList.contains('collapsed');if(open&&!savedMode)setDiscoveryOpen(false);else setCollection(false);closeDetail();};$('#saved-button').onclick=()=>{const open=!$('#discovery').classList.contains('collapsed');if(open&&savedMode)setDiscoveryOpen(false);else setCollection(true);closeDetail();};$('#random-button').onclick=()=>openPlace(places[Math.floor(Math.random()*places.length)]);$('#home-button').onclick=home;$('#rotate-button').onclick=()=>{if(!viewer)return;rotating=!rotating;$('#rotate-button').setAttribute('aria-pressed',String(rotating));$('#rotate-button').setAttribute('aria-label',rotating?'Pause automatic rotation':'Start automatic rotation');viewer.scene.requestRender();};$('#zoom-in').onclick=()=>smoothZoom(.72);$('#zoom-out').onclick=()=>smoothZoom(1.38);$('#north-button').onclick=()=>{if(viewer)viewer.camera.flyTo({destination:viewer.camera.positionWC,orientation:{heading:0,pitch:viewer.camera.pitch,roll:0},duration:reducedMotion?0:.7});};$$('[data-layer]').forEach(b=>b.onclick=()=>setLayer(b.dataset.layer));$('#settings-button').onclick=()=>$('#settings').hidden=!$('#settings').hidden;$('#close-settings').onclick=()=>$('#settings').hidden=true;$('#atmosphere-toggle').onchange=e=>{if(viewer){viewer.scene.skyAtmosphere.show=e.target.checked;viewer.scene.globe.showGroundAtmosphere=false;viewer.scene.requestRender();}};$('#clouds-toggle').onchange=()=>viewer?.scene.requestRender();$('#markers-toggle').onchange=e=>{markers.forEach(m=>m.show=e.target.checked&&globeMode==='aurora');viewer?.scene.requestRender();};$('#quality-toggle').onchange=()=>applyQuality(qualityMoving);const about=()=>$('#about').showModal();$('#help-button').onclick=about;$('#sources-button').onclick=about;$('#close-about').onclick=()=>$('#about').close();$('#start-exploring').onclick=()=>$('#about').close();$('#about').addEventListener('click',e=>{if(e.target===$('#about')&&e.offsetY<0)$('#about').close();});document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#search-results').hidden=true;$('#settings').hidden=true;closeDetail();}});document.addEventListener('click',e=>{if(!e.target.closest('.search'))$('#search-results').hidden=true;});}
// Phone-first globe modes and sourced country statistics.
let countryImagery, paintGeneration = 0;
let globeMode = 'aurora', countryLayer, countryPromise, countryFeatures = [], activeMetric = 'population';
let metricGeneration = 0, metricData = null, activeYear = '', countrySelection = null, qualityMoving = false;
const dataMemory = new Map();
const D = WorldScopeData;
function smoothZoom(factor) {
  if (!viewer) return;
  stopRotation();
  viewer.camera.cancelFlight();
  const p = viewer.camera.positionCartographic;
  const height = Math.max(150, Math.min(42000000, p.height * factor));
  viewer.camera.flyTo({ destination: C.Cartesian3.fromRadians(p.longitude, p.latitude, height), orientation: { heading: viewer.camera.heading, pitch: viewer.camera.pitch, roll: viewer.camera.roll }, duration: reducedMotion ? 0 : .45, easingFunction: C.EasingFunction.QUADRATIC_OUT });
}
function applyQuality(moving) {
  if (!viewer) return;
  qualityMoving = moving;
  // Cesium uses CSS pixel resolution by default. Bound the render target on high-DPR phones.
  viewer.resolutionScale = moving ? .85 : ($('#quality-toggle').checked ? 1.5 : 1.15);
  viewer.scene.globe.maximumScreenSpaceError = moving ? 5 : ($('#quality-toggle').checked ? 2 : 3);
  viewer.scene.requestRender();
}
async function ensureCountries() {
  if (countryLayer) return countryLayer;
  if (countryPromise) return countryPromise;
  countryPromise = (async () => {
    const geo = await json('./assets/countries.geojson');
    countryFeatures = geo.features;
    const data = new C.CustomDataSource('Country labels');
    for (const f of countryFeatures) {
      const p = f.properties;
      const entity = data.entities.add({position:C.Cartesian3.fromDegrees(p.lon,p.lat,2000),label:{text:p.name,font:'11px system-ui',fillColor:C.Color.fromCssColorString('#ddfaff'),outlineColor:C.Color.fromCssColorString('#07101c'),outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,distanceDisplayCondition:new C.DistanceDisplayCondition(0,14000000),scaleByDistance:new C.NearFarScalar(1000000,1,14000000,.7)}});
      entity.worldscopeCountry=p.iso3;
    }
    countryLayer = await viewer.dataSources.add(data);
    countryLayer.show = globeMode === 'atlas';
    return countryLayer;
  })().catch(error => { countryPromise = null; throw error; });
  return countryPromise;
}
function findCountry(lon,lat) {
  return countryFeatures.find(f=>D.contains(f.geometry,lon,lat));
}
async function paintCountries() {
  if (!countryLayer) return;
  const generation=++paintGeneration, mode=globeMode;
  countryLayer.show=mode==='atlas';
  if(mode==='aurora'){if(countryImagery)countryImagery.show=false;return;}
  const values=metricData?.years[activeYear]||{}, all=Object.values(values);
  // A single geographic texture avoids triangulating hundreds of polygons on a phone.
  const canvas=document.createElement('canvas');canvas.width=4096;canvas.height=2048;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#061321';ctx.fillRect(0,0,canvas.width,canvas.height);
  const low=C.Color.fromCssColorString('#10cbd0'),high=C.Color.fromCssColorString('#a04cff');
  for(const f of countryFeatures){
    const code=f.properties.iso3, value=values[code];
    ctx.fillStyle=mode==='atlas'?'#12334a':value===undefined?'#455160':C.Color.lerp(low,high,D.scale(value,all),new C.Color()).toCssColorString();
    ctx.strokeStyle=code===countrySelection?'#ffffff':mode==='atlas'?'#35d8e6':'#182c43';
    ctx.lineWidth=code===countrySelection?8:3.5;
    const polygons=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];
    for(const polygon of polygons){
      ctx.beginPath();
      for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const x=(lon+180)/360*canvas.width,y=(90-lat)/180*canvas.height;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}
      ctx.fill('evenodd');ctx.stroke();
    }
  }
  try{
    const provider=await C.SingleTileImageryProvider.fromUrl(canvas.toDataURL('image/png'),{credit:'Natural Earth · approximate country boundaries'});
    if(generation!==paintGeneration||mode!==globeMode){return;}
    const previous=countryImagery;
    countryImagery=viewer.imageryLayers.addImageryProvider(provider);
    if(previous)viewer.imageryLayers.remove(previous,true);
    viewer.scene.requestRender();
  }catch{if(generation===paintGeneration)toast('Country colors could not render. Try switching views.');}
}
async function setMode(mode) {
  globeMode = mode;
  document.body.dataset.mode = mode;
  closeDetail();
  $('#country-card').hidden = true;
  $('#insights').hidden = mode !== 'insights';
  setDiscoveryOpen(false);
  $$('.layer[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  $('#mode-number').textContent = ({aurora:'01 / AURORA',atlas:'02 / ATLAS',insights:'03 / INSIGHTS'})[mode];
  $('#mode-title').textContent = ({aurora:'A little perspective.',atlas:'A world of connections.',insights:'See the bigger picture.'})[mode];
  $('#view-status').textContent = mode === 'aurora' ? 'OUR HOME, IN A DIFFERENT LIGHT' : mode === 'atlas' ? 'TAP A COUNTRY TO EXPLORE' : 'REAL SOURCES. A CLEARER WORLD.';
  if (!viewer) return;
  if (mode !== 'aurora') { await setLayer('satellite'); $('#surface').value='satellite'; $('#view-status').textContent=mode==='atlas'?'TAP A COUNTRY TO EXPLORE':'REAL SOURCES. A CLEARER WORLD.'; }
  if (countryLayer) countryLayer.show = mode === 'atlas';
  if (countryImagery) countryImagery.show = mode !== 'aurora';
  if (mode === 'aurora') paintGeneration++;
  markers.forEach(m => m.show = mode === 'aurora' && $('#markers-toggle').checked);
  const base = viewer.imageryLayers.get(1);
  viewer.imageryLayers.get(0).brightness = mode === 'aurora' ? .85 : .4;
  base.brightness = mode === 'aurora' ? .92 : .38;
  base.saturation = mode === 'aurora' ? 1.12 : .35;
  viewer.scene.requestRender();
  if (mode !== 'aurora') {
    try {
      await ensureCountries();
      paintCountries();
      if (globeMode === 'insights') await loadMetric(activeMetric);
    } catch { toast('Country boundaries could not load. Tap this mode again to retry.'); }
  }
}
function selectCountry(code, focus = false) {
  countrySelection = code;
  const f = countryFeatures.find(f => f.properties.iso3 === code);
  if (!f) return;
  const p = f.properties;
  if (globeMode === 'atlas') {
    $('#country-card').hidden = false;
    $('#country-card').innerHTML = `<button class="close-button" aria-label="Close country">×</button><span class="eyebrow">ATLAS</span><h2>${esc(p.name)}</h2><p>Explore its place in the world.</p><button class="secondary" id="compare-country">View country statistics</button>`;
    $('#country-card .close-button').onclick = () => { $('#country-card').hidden = true; };
    $('#compare-country').onclick = () => setMode('insights');
  } else renderCountry();
  paintCountries();
  if (focus) viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(p.lon,p.lat,17000000),duration:reducedMotion?0:1.1});
}
function renderCountry() {
  const f = countryFeatures.find(f => f.properties.iso3 === countrySelection);
  if (!f) { $('#country-stat').innerHTML = '<p>Tap a country or a ranked entry to inspect its value.</p>'; return; }
  const values = metricData?.years[activeYear] || {}, value = values[countrySelection];
  const sorted = D.rank(values), rank = sorted.findIndex(r => r[0] === countrySelection) + 1;
  $('#country-stat').innerHTML = `<span class="eyebrow">${esc(f.properties.name)}</span><strong>${D.format(value,activeMetric)}</strong><small>${value === undefined ? 'No value available for this selection' : `${activeYear} · ${D.metrics[activeMetric].unit} · ${rank} of ${sorted.length} mapped countries with data`}</small>`;
}
function renderMetric() {
  const values = metricData?.years[activeYear] || {}, rows = D.rank(values);
  $('#data-legend').hidden = !rows.length;
  $('#ranking').hidden = !rows.length;
  if (rows.length) {
    $('#legend-min').textContent = D.format(rows.at(-1)[1],activeMetric,true);
    $('#legend-max').textContent = D.format(rows[0][1],activeMetric,true);
  }
  $('#ranking-list').innerHTML = rows.slice(0,10).map(([code,value]) => `<li><button data-country="${code}"><span>${esc(countryFeatures.find(f=>f.properties.iso3===code)?.properties.name||code)}</span><b>${D.format(value,activeMetric,true)}</b></button></li>`).join('');
  $$('[data-country]').forEach(b => b.onclick = () => { $('#ranking').open = false; selectCountry(b.dataset.country,true); });
  renderCountry(); paintCountries();
}
async function loadMetric(metric, refresh = false) {
  const generation = ++metricGeneration;
  activeMetric = metric; metricData = null; activeYear = '';
  const spec = D.metrics[metric];
  $('#metric-title').textContent = spec.title;
  $$('[data-metric]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.metric===metric)));
  $('#data-status').textContent = 'Loading verified country figures…';
  $('#data-source').textContent = spec.note;
  $('#retry-data').hidden = true; $('#data-year').disabled = true; $('#data-year').innerHTML = '';
  renderMetric();
  let result, fetchedAt, cached = false;
  try {
    const codes = new Set(countryFeatures.map(f => f.properties.iso3));
    const key = 'worldscope.wdi.v1.' + metric;
    if (!refresh && dataMemory.has(metric)) ({result,fetchedAt,cached} = dataMemory.get(metric));
    else {
      const now = new Date().getUTCFullYear();
      const url = `https://api.worldbank.org/v2/country/all/indicator/${spec.indicator}?source=2&format=json&per_page=20000&date=${now-5}:${now}`;
      try {
        const payload = await json(url,20000);
        result = D.parse(payload,codes); fetchedAt = new Date().toISOString();
        try { localStorage.setItem(key,JSON.stringify({payload,fetchedAt})); } catch {}
      } catch (error) {
        let saved;
        try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
        if (!saved || !Number.isFinite(Date.parse(saved.fetchedAt))) throw error;
        result = D.parse(saved.payload,codes); fetchedAt = saved.fetchedAt; cached = true;
      }
      dataMemory.set(metric,{result,fetchedAt,cached});
    }
    if (generation !== metricGeneration) return;
    metricData = result; activeYear = result.available[0];
    $('#data-year').innerHTML = result.available.map(y=>`<option>${y}</option>`).join(''); $('#data-year').disabled = false;
    $('#data-status').textContent = `${cached?'Cached':'Retrieved'} ${fetchedAt.slice(0,10)} · Latest year with broad coverage: ${activeYear}.`;
    $('#data-source').innerHTML = `<a href="https://data.worldbank.org/indicator/${spec.indicator}" target="_blank" rel="noopener">${spec.source} ↗</a> · ${esc(spec.note)} ${result.updated?'Provider updated '+esc(result.updated)+'.':''}`;
    $('#retry-data').hidden = !cached;
    renderMetric();
  } catch {
    if (generation !== metricGeneration) return;
    $('#data-status').textContent = 'Data is unavailable. Check your connection and retry. No estimated values are shown.';
    $('#retry-data').hidden = false;
    renderMetric();
  }
}
function bindModes() {
  $$('[data-mode].layer').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  $$('[data-metric]').forEach(b=>b.onclick=()=>loadMetric(b.dataset.metric));
  $('#data-year').onchange=e=>{activeYear=e.target.value;renderMetric();};
  $('#retry-data').onclick=()=>loadMetric(activeMetric,true);
  $('#surface').onchange=async e=>{if(globeMode!=='aurora')await setMode('aurora');setLayer(e.target.value);};
}

bind();bindModes();initGlobe().then(()=>setMode(globeMode));
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
