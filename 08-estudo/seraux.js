(() => {
 const hero=document.querySelector('.hero'),controls=document.querySelector('.motion-controls');
 const replay=document.getElementById('replay'),pause=document.getElementById('pause'),diagram=document.getElementById('diagram');
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let loaded=false;
 const reset=()=>{hero.classList.remove('paused','diagram-mode');pause.disabled=false;pause.textContent='Pausar';pause.setAttribute('aria-pressed','false');diagram.textContent='Ver esquema';diagram.setAttribute('aria-pressed','false');};
 const play=()=>{reset();hero.classList.remove('running');void hero.offsetWidth;if(loaded&&!reduced.matches)hero.classList.add('running');};
 replay.addEventListener('click',play);
 pause.addEventListener('click',()=>{if(pause.disabled||reduced.matches)return;const p=hero.classList.toggle('paused');pause.textContent=p?'Continuar':'Pausar';pause.setAttribute('aria-pressed',String(p));});
 diagram.addEventListener('click',()=>{if(!loaded||reduced.matches)return;hero.classList.remove('running','paused');const active=hero.classList.toggle('diagram-mode');diagram.textContent=active?'Ver fotografía':'Ver esquema';diagram.setAttribute('aria-pressed',String(active));pause.disabled=true;pause.textContent='Vista estática';pause.setAttribute('aria-pressed','false');});
 hero.addEventListener('animationend',e=>{if(e.animationName==='materialize'&&!hero.classList.contains('diagram-mode')){pause.disabled=true;pause.textContent='Animación finalizada';}});
 const bg=new Image();bg.src='../03-hero/papel-tecnico.webp';const wheel=document.querySelector('.wheel');
 const decode=img=>img.decode?img.decode():new Promise((ok,no)=>{if(img.complete){img.naturalWidth?ok():no();}else{img.addEventListener('load',ok,{once:true});img.addEventListener('error',no,{once:true});}});
 Promise.all([wheel,bg].map(decode)).then(()=>{loaded=true;if(!reduced.matches){hero.classList.add('ready-motion');controls.hidden=false;play();}}).catch(()=>{hero.classList.remove('ready-motion');controls.hidden=true;});
 const change=()=>{hero.classList.remove('running','ready-motion');reset();controls.hidden=reduced.matches||!loaded;if(loaded&&!reduced.matches){hero.classList.add('ready-motion');play();}};if(reduced.addEventListener)reduced.addEventListener('change',change);
 const header=document.querySelector('.site-header'),menu=document.querySelector('.menu-toggle');const close=()=>{header.classList.remove('menu-open');menu.setAttribute('aria-expanded','false');};
 menu.addEventListener('click',()=>{const p=header.classList.toggle('menu-open');menu.setAttribute('aria-expanded',String(p));});document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',close));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&header.classList.contains('menu-open')){close();menu.focus();}});
})();