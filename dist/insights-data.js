/* World Bank WDI. No estimated or placeholder values are displayed. */
(function (root) {
  'use strict';
  const metrics = {
    population: { title: 'Population', indicator: 'SP.POP.TOTL', unit: 'people', source: 'World Bank WDI', note: 'Total resident population.' },
    gdp: { title: 'Economy · total GDP', indicator: 'NY.GDP.MKTP.CD', unit: 'USD', source: 'World Bank WDI', note: 'Total GDP in current US dollars; not GDP per person or purchasing-power adjusted.' },
    military: { title: 'Military expenditure', indicator: 'MS.MIL.XPND.CD', unit: 'USD', source: 'SIPRI via World Bank WDI', note: 'Annual spending in current US dollars; not a ranking of military capability.' }
  };
  function parse(payload, codes) {
    if (!Array.isArray(payload) || !payload[0] || !Array.isArray(payload[1])) throw new Error('Unexpected data response');
    if (Number(payload[0].pages) !== 1) throw new Error('Incomplete data response');
    const years = {};
    for (const row of payload[1]) {
      if (!codes.has(row.countryiso3code) || !/^\d{4}$/.test(row.date) || typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 0) continue;
      (years[row.date] ||= {})[row.countryiso3code] = row.value;
    }
    // A recent partial release must not silently replace a broadly covered year.
    const available = Object.keys(years).filter(y => Object.keys(years[y]).length >= 80).sort().reverse();
    if (!available.length) throw new Error('No reporting year with sufficient country coverage');
    return { years, available, updated: payload[0].lastupdated || null };
  }
  function scale(value, values) {
    const logs = values.filter(Number.isFinite).map(x => Math.log1p(x));
    const min = Math.min(...logs), max = Math.max(...logs);
    return max === min ? .5 : Math.max(0, Math.min(1, (Math.log1p(value) - min) / (max - min)));
  }
  function rank(values) { return Object.entries(values).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
  function format(value, metric, compact = false) {
    if (!Number.isFinite(value)) return 'No reported data';
    return new Intl.NumberFormat('en', { notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 1 : 0, ...(metrics[metric].unit === 'USD' ? { style: 'currency', currency: 'USD' } : {}) }).format(value);
  }
  function contains(geometry,lon,lat) {
    function inRing(ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const [x,y]=ring[i],[xj,yj]=ring[j];
      if((y>lat)!==(yj>lat)&&lon<(xj-x)*(lat-y)/(yj-y)+x)inside=!inside;
    }return inside;}
    const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];
    return polygons.some(rings=>inRing(rings[0])&&!rings.slice(1).some(inRing));
  }
  root.WorldScopeData = { metrics, parse, scale, rank, format, contains };
  if (typeof module !== 'undefined') module.exports = root.WorldScopeData;
})(typeof window !== 'undefined' ? window : globalThis);
