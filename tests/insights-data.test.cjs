const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../dist/insights-data.js');
const codes=new Set(Array.from({length:85},(_,i)=>'C'+i));
const rows=[...codes].map((code,i)=>({countryiso3code:code,date:'2024',value:i*100}));
test('selects latest broadly covered year; excludes aggregates, nulls and invalid values',()=>{
 const result=D.parse([{pages:1,lastupdated:'2026-01-01'},[...rows,{countryiso3code:'C0',date:'2025',value:12},{countryiso3code:'WLD',date:'2024',value:999999},{countryiso3code:'C1',date:'2025',value:null},{countryiso3code:'C2',date:'2025',value:-1}]],codes);
 assert.deepEqual(result.available,['2024']);assert.equal(Object.keys(result.years['2024']).length,85);assert.equal(result.years['2024'].C0,0);assert.equal(result.years['2025'].C1,undefined);
});
test('rejects truncated, malformed or insufficient responses',()=>{
 for(const response of [[{pages:2},rows],{},[{pages:1},[]]])assert.throws(()=>D.parse(response,codes));
});
test('logarithmic colors retain zero and spread unequal values',()=>{
 assert.equal(D.scale(0,[0,100,10000]),0);assert.equal(D.scale(10000,[0,100,10000]),1);assert.ok(D.scale(100,[0,100,10000])>.45);assert.equal(D.scale(1,[1,1]),.5);
});
test('ranking and missing values stay distinct from zero',()=>{
 assert.deepEqual(D.rank({USA:20,CHN:10,IND:0}),[['USA',20],['CHN',10],['IND',0]]);assert.equal(D.format(undefined,'population'),'No reported data');assert.equal(D.format(0,'population'),'0');
});
test('country picking handles islands, polygon holes, and ocean',()=>{
 const geometry={type:'MultiPolygon',coordinates:[[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]],[[[20,0],[22,0],[22,2],[20,2],[20,0]]]]};
 assert.equal(D.contains(geometry,1,1),true);assert.equal(D.contains(geometry,5,5),false);assert.equal(D.contains(geometry,21,1),true);assert.equal(D.contains(geometry,15,1),false);
});
test('bundled geographic coordinates identify Iraq and separate Pacific islands',()=>{
 const fs=require('node:fs');const features=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../dist/assets/countries.geojson'))).features;
 const find=(lon,lat)=>features.find(f=>D.contains(f.geometry,lon,lat))?.properties.iso3;
 assert.equal(find(44,33),'IRQ');assert.equal(find(-100,40),'USA');assert.equal(find(150,0),undefined);
});
