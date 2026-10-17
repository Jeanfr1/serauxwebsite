const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
async function test(reduce=false,fail=false){
 const nodes={};const get=k=>nodes[k]||(nodes[k]={classes:new Set(),attrs:{},events:{},offsetWidth:1200,hidden:true,disabled:false,classList:{add(...ss){ss.forEach(s=>nodes[k].classes.add(s))},remove(...ss){ss.forEach(s=>nodes[k].classes.delete(s))},contains(s){return nodes[k].classes.has(s)},toggle(s){const z=nodes[k].classes;z.has(s)?z.delete(s):z.add(s);return z.has(s)}},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){this.events[k]=f},focus(){this.focused=true}});
 const mq={matches:reduce,addEventListener(k,f){this.change=f}};
 const wheel=get('.wheel');wheel.decode=()=>fail?Promise.reject(Error('missing')):Promise.resolve();
 const doc={querySelector:get,getElementById:get,querySelectorAll:s=>s==='nav a'?[get('navlink')]:[],events:{},addEventListener(k,f){this.events[k]=f}};
 function Image(){this.decode=()=>Promise.resolve()}
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../08-estudo/seraux.js'),'utf8'),{document:doc,window:{matchMedia:()=>mq},Image,Promise,console});await new Promise(r=>setImmediate(r));
 const h=get('.hero'),ctl=get('.motion-controls'),pause=get('pause'),diagram=get('diagram');
 if(fail){assert(!h.classes.has('ready-motion'));assert(ctl.hidden);return;}
 assert.equal(h.classes.has('ready-motion'),!reduce);assert.equal(ctl.hidden,reduce);
 pause.events.click();assert.equal(h.classes.has('paused'),!reduce);get('replay').events.click();assert(!h.classes.has('paused'));
 diagram.events.click();assert.equal(h.classes.has('diagram-mode'),!reduce);
 if(!reduce){assert(pause.disabled);diagram.events.click();assert(!h.classes.has('diagram-mode'));get('replay').events.click();assert(h.classes.has('running'));assert(!pause.disabled);h.events.animationend({animationName:'materialize'});assert(pause.disabled);get('replay').events.click();assert(!pause.disabled);}
 get('.menu-toggle').events.click();assert.equal(get('.menu-toggle').attrs['aria-expanded'],'true');doc.events.keydown({key:'Escape'});assert(!get('.site-header').classes.has('menu-open'));assert(get('.menu-toggle').focused);
 get('.menu-toggle').events.click();get('navlink').events.click();assert(!get('.site-header').classes.has('menu-open'));
 mq.matches=true;mq.change();assert(ctl.hidden);assert(!h.classes.has('ready-motion'));
}
(async()=>{await test();await test(true);await test(false,true);console.log('PASS: replay/pause/end, diagram/photo mode, reduced motion, image fallback, mobile menu and Escape. DOM contracts only.');})().catch(e=>{console.error(e);process.exit(1)});
