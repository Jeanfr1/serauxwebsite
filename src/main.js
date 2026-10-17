import './style.css';
import { initHero } from './hero.js';

initHero();

// mobile menu
const header = document.querySelector('.site-header');
const toggle = header.querySelector('.menu-toggle');
const closeMenu = () => {
  header.classList.remove('menu-open');
  toggle.setAttribute('aria-expanded', 'false');
};
toggle.addEventListener('click', () => {
  const open = header.classList.toggle('menu-open');
  toggle.setAttribute('aria-expanded', String(open));
});
header.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && header.classList.contains('menu-open')) { closeMenu(); toggle.focus(); }
});
document.addEventListener('click', (e) => { if (!header.contains(e.target)) closeMenu(); });

// gentle reveal of the section copy and photos (the script owns the hidden state)
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const items = document.querySelectorAll('.sheet-copy, .sheet-photo');
  items.forEach((el) => el.setAttribute('data-reveal', ''));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  document.documentElement.classList.add('reveal-on');
  items.forEach((el) => io.observe(el));
}
