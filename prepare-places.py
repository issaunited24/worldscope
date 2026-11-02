import urllib.request,urllib.parse,json,concurrent.futures,pathlib,time
base=pathlib.Path(__file__).resolve().parent/'dist'; ua={'User-Agent':'WorldScope/1.0 (personal educational atlas; source links provided)'}
places=[
('Petra','Petra','Jordan','history','ANCIENT WONDER',30.3285,35.4444,15000),
('Kyoto','Kyoto','Japan','city','CULTURE & CALM',35.0116,135.7681,45000),
('Grand Canyon','Grand Canyon','United States','nature','NATURAL WONDER',36.1069,-112.1129,70000),
('Erbil Citadel','Citadel of Erbil','Kurdistan Region · Iraq','history','LAYERS OF HISTORY',36.1912,44.0092,7000),
('The Pyramids of Giza','Giza pyramid complex','Egypt','history','ANCIENT WONDER',29.9792,31.1342,12000),
('Machu Picchu','Machu Picchu','Peru','history','ABOVE THE CLOUDS',-13.1631,-72.545,14000),
('Mount Everest','Mount Everest','Nepal · China','nature','THE ROOF OF THE WORLD',27.9881,86.925,60000),
('Rome','Rome','Italy','city','THE ETERNAL CITY',41.9028,12.4964,42000),
('Istanbul','Istanbul','Türkiye','city','WHERE WORLDS MEET',41.0082,28.9784,50000),
('Great Barrier Reef','Great Barrier Reef','Australia','nature','AN OCEAN OF LIFE',-18.2871,147.6992,350000),
('Serengeti','Serengeti National Park','Tanzania','nature','INTO THE WILD',-2.3333,34.8333,150000),
('Angkor Wat','Angkor Wat','Cambodia','history','A KINGDOM IN STONE',13.4125,103.867,12000),
('Tokyo','Tokyo','Japan','city','AFTER DARK',35.6762,139.6503,55000),
('Paris','Paris','France','city','THE CITY OF LIGHT',48.8566,2.3522,40000),
('New York City','New York City','United States','city','NEVER STANDING STILL',40.7128,-74.006,50000),
('Kirkjufell','Kirkjufell','Iceland','nature','FIRE & ICE',64.9244,-23.3122,18000)]
def get(url):
 for n in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=ua),timeout=25) as r:return r.read()
  except Exception:
   if n==2:raise

def build(item):
 name,wiki,country,category,tag,lat,lon,height=item
 d=dict(id=wiki.lower().replace(' ','-'),name=name,wiki=wiki,country=country,category=category,tag=tag,lat=lat,lon=lon,height=height,source='https://en.wikipedia.org/wiki/'+urllib.parse.quote(wiki.replace(' ','_')))
 try:
  j=json.loads(get('https://en.wikipedia.org/api/rest_v1/page/summary/'+urllib.parse.quote(wiki.replace(' ','_'))));d.update(summary=j.get('extract',''),description=j.get('description',''),wikibase=j.get('wikibase_item'),image=j.get('thumbnail',{}).get('source'),photoSource=j.get('content_urls',{}).get('desktop',{}).get('page',d['source']))
  if d.get('image'):
   imgurl=d['image']; filename=d['id']+'.jpg';(base/'assets'/filename).write_bytes(get(imgurl)); d['remoteImage']=d['image'];d['image']='./assets/'+filename
  print('Prepared',name,flush=True)
 except Exception as e:print('Failed',name,str(e),flush=True)
 return d
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:result=list(ex.map(build,places))
(base/'places.js').write_text('window.WORLDSCOPE_PLACES = '+json.dumps(result,ensure_ascii=False)+';\n')
