/* Manuales: cabecera que se asienta al bajar, titular por letras, bloques que se montan con el scroll (scrub),
   índice que marca la sección en la que estás y botón de copiar en los comandos. Con movimiento reducido, todo
   queda visible y quieto. */
(function () {
  'use strict';

  // Idioma: se recuerda el que se elige; la primera vez, quien no tiene el navegador en español va a la versión inglesa.
  var guarda = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  document.querySelectorAll('.idioma a').forEach(function (a) {
    a.addEventListener('click', function () { guarda('manual-idioma', a.dataset.idioma); });
  });
  if (document.documentElement.lang === 'es' && document.body.classList.contains('es-portada') && !guarda('manual-idioma')) {
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'es';
    var en = document.querySelector('.idioma a[data-idioma="en"]');
    if (!/^es(-|$)/i.test(nav) && en) { location.replace(en.href); return; }
  }

  // Copiar comandos (no depende de GSAP).
  document.querySelectorAll('.codigo .copiar').forEach(function (b) {
    b.addEventListener('click', function () {
      var texto = b.parentElement.querySelector('code').innerText.replace(/\n$/, '');
      var hecho = function () {
        b.textContent = document.body.dataset.copiado || 'Copiado';
        b.classList.add('hecho');
        setTimeout(function () { b.textContent = document.body.dataset.copiar || 'Copiar'; b.classList.remove('hecho'); }, 1600);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(texto).then(hecho, function () {});
    });
  });

  var cabecera = document.getElementById('cabecera');
  if (!window.gsap || !window.ScrollTrigger) {
    // Sin GSAP (sin internet): la página se lee igual; la cabecera cambia con un scroll normal.
    addEventListener('scroll', function () { cabecera.classList.toggle('is-scrolled', scrollY > 80); }, { passive: true });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  ScrollTrigger.create({
    start: 'top -80',
    onUpdate: function (self) { cabecera.classList.toggle('is-scrolled', self.scroll() > 80); },
  });
  cabecera.classList.toggle('is-scrolled', scrollY > 80);

  // Índice: la sección que está a la vista queda marcada.
  var enlaces = {};
  document.querySelectorAll('.indice a').forEach(function (a) { enlaces[a.getAttribute('href').slice(1)] = a; });
  document.querySelectorAll('.bloque').forEach(function (s) {
    var id = s.getAttribute('aria-labelledby');
    if (!enlaces[id]) return;
    ScrollTrigger.create({
      trigger: s, start: 'top 45%', end: 'bottom 45%',
      onToggle: function (self) { if (self.isActive) marca(id); },
    });
  });
  function marca(id) {
    Object.keys(enlaces).forEach(function (k) { enlaces[k].classList.toggle('activo', k === id); });
  }

  gsap.matchMedia().add(
    { reducido: '(prefers-reduced-motion: reduce)', completo: '(prefers-reduced-motion: no-preference)' },
    function (ctx) {
      if (ctx.conditions.reducido) {
        gsap.set('.titular, .entradilla, .figura, .bloque > *', { opacity: 1, clearProps: 'transform' });
        return;
      }
      entrada();
      scroll();
    }
  );

  // Portada: el titular entra letra a letra, luego la entradilla y la captura.
  function entrada() {
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    if (window.SplitText) {
      var letras = new SplitText('.titular', { type: 'words,chars', charsClass: 'char' });
      tl.from(letras.chars, { opacity: 0, y: 60, rotateX: -70, transformOrigin: '50% 100% -40', stagger: .022, duration: .8 });
    } else {
      tl.from('.titular', { opacity: 0, y: 40, duration: .8 });
    }
    tl.from('.entradilla', { opacity: 0, y: 20, duration: .7 }, '-=.5');
    var portada = document.querySelector('.figura-portada');
    if (portada) {
      // Revelado de cortina: la captura de la tele aparece de arriba abajo.
      tl.fromTo(portada, { clipPath: 'inset(0 0 100% 0 round 22px)', scale: .9 },
        { clipPath: 'inset(0 0 0% 0 round 22px)', scale: 1, duration: 1.2 }, '-=.5');
    }
  }

  // Cada sección se monta con el scroll: el titular por letras, el texto sube, las capturas se asientan.
  function scroll() {
    document.querySelectorAll('.bloque').forEach(function (bloque) {
      var h2 = bloque.querySelector('h2');
      if (h2 && window.SplitText) {
        var letras = new SplitText(h2, { type: 'words,chars', charsClass: 'char' });
        gsap.from(letras.chars, {
          opacity: 0, y: 40, rotateX: -70, transformOrigin: '50% 100% -20', stagger: .014, duration: .7, ease: 'expo.out',
          scrollTrigger: { trigger: h2, start: 'clamp(top 88%)' },
        });
      }
      bloque.querySelectorAll(':scope > :not(h2):not(.figura)').forEach(function (el) {
        gsap.fromTo(el, { opacity: 0, y: 70 }, {
          opacity: 1, y: 0, ease: 'none',
          scrollTrigger: { trigger: el, start: 'clamp(top 92%)', end: 'clamp(top 55%)', scrub: .7 },
        });
      });
      bloque.querySelectorAll('.figura').forEach(function (fig) {
        gsap.fromTo(fig, { opacity: 0, y: 90, scale: .88, rotate: -1.5 }, {
          opacity: 1, y: 0, scale: 1, rotate: 0, ease: 'none',
          scrollTrigger: { trigger: fig, start: 'clamp(top 92%)', end: 'clamp(top 45%)', scrub: .7 },
        });
      });
    });
    gsap.fromTo('.paso a', { opacity: 0, y: 40 }, {
      opacity: 1, y: 0, ease: 'none', stagger: .1,
      scrollTrigger: { trigger: '.paso', start: 'clamp(top 95%)', end: 'clamp(top 70%)', scrub: .7 },
    });
  }

  document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
