from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
from PIL import Image
import re,json,hashlib,xml.etree.ElementTree as ET
R=Path(__file__).resolve().parents[1];errors=[];count=0
def ref(v,base):
 global count
 if not v or v.startswith(('#','http:','https:','tel:','mailto:','data:')):return
 p=(base/unquote(urlsplit(v).path)).resolve();count+=1
 if not p.is_file():errors.append(str(p))
class Parser(HTMLParser):
 def __init__(self,base):super().__init__();self.base=base;self.ids=set();self.anchors=[]
 def handle_starttag(self,tag,attrs):
  for k,v in attrs:
   if k=='id':self.ids.add(v)
   if k in ['src','href']:
    ref(v,self.base)
    if v and v.startswith('#'):self.anchors.append(v[1:])
for f in R.rglob('*.html'):
 p=Parser(f.parent);p.feed(f.read_text());assert all(a in p.ids for a in p.anchors),(f,p.anchors)
for f in R.rglob('*.css'):
 for s in re.findall(r'url\([\x27\"]?([^\x27\"\)]+)',f.read_text()):ref(s,f.parent)
for f in R.rglob('*.json'):json.loads(f.read_text())
for f in R.rglob('*.svg'):
 s=f.read_text();ET.fromstring(s);assert '<image' not in s and 'base64' not in s
for f in [R/'01-identidade/seraux-logo-transparente.png',R/'05-camadas/pneu.png']:
 im=Image.open(f);assert im.mode=='RGBA';lo,hi=im.getchannel('A').getextrema();assert lo==0 and hi>=250
for item in json.loads((R/'07-integracao/proveniencia.json').read_text())['originals']:assert hashlib.sha256((R/item['file']).read_bytes()).hexdigest()==item['sha256']
if (R/'MANIFESTO-SHA256.json').exists():
 for p,h in json.loads((R/'MANIFESTO-SHA256.json').read_text()).items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p
assert not errors,errors
print(f'PASS: {count} references, anchors, JSON, vector SVG, alpha, original hashes and manifest if present.')
