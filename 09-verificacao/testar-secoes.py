from pathlib import Path
from html.parser import HTMLParser
import hashlib,json
R=Path(__file__).resolve().parents[1]
class Layout(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.rows={};self.current=None;self.depth=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='section' and a.get('id') in ['neumaticos','servicios','taller']:
   self.current=a['id'];self.depth=len(self.stack);self.rows[self.current]={'layout':a.get('data-layout'),'children':[]}
  elif self.current and len(self.stack)==self.depth+1 and tag in ['article','div']:
   self.rows[self.current]['children'].append(a.get('class'))
  if tag not in ['img','br','meta','link','input','hr','source']:self.stack.append(tag)
 def handle_endtag(self,tag):
  if tag=='section' and self.current and len(self.stack)==self.depth+1:self.current=None
  if self.stack and self.stack[-1]==tag:self.stack.pop()
p=Layout();p.feed((R/'08-estudo/index.html').read_text())
expected={'neumaticos':('copy-photo',['sheet-copy','sheet-photo']),'servicios':('photo-copy',['sheet-photo','sheet-copy']),'taller':('copy-photo',['visit-copy','visit-photo'])}
for k,(layout,children) in expected.items():assert p.rows[k]=={'layout':layout,'children':children},(k,p.rows[k])
css=(R/'08-estudo/seraux.css').read_text()
for obsolete in ['.panel-shade','.technical-rail','.photo-panel']:assert obsolete not in css,obsolete
assert '.sheet-copy h2 span{color:var(--red)}' in css and 'background-color:var(--paper)' in css
for p,h in json.loads((R/'09-verificacao/HERO-PRESERVADO.json').read_text()).items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p
print('PASS: clear sections in approved order; obsolete dark panels absent; hero assets and motion preserved.')
