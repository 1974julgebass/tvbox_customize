/*
 * Efecto de scroll común (estándar de la casa, adaptado de runners/js/landing.js vía roomba).
 * Pantalla de tarea: la cabecera gana fondo al bajar, el titular visible entra por caracteres y
 * las secciones se montan con el scroll. tvbox.js decide qué hero se ve (sin conexión o mando)
 * y luego llama a PanelScroll.intro(); al conectar, PanelScroll.sections() monta las secciones.
 */
(function () {
  'use strict';

  var api = { intro: function () {}, refresh: function () {}, sections: function () {} };
  window.PanelScroll = api;
  if (!window.gsap || !window.ScrollTrigger || !window.SplitText) return;

  gsap.registerPlugin(ScrollTrigger, SplitText);
  api.refresh = function () { ScrollTrigger.refresh(); };

  var header = document.getElementById('siteHeader');
  if (header) {
    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: function (self) { header.classList.toggle('is-scrolled', self.scroll() > 80); },
    });
  }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var introDone = false;

  api.intro = function () {
    if (introDone || reduced) return;
    var hero = document.querySelector('.hero:not([hidden])');
    if (!hero) return;
    introDone = true;
    var title = hero.querySelector('.status-title');
    title.dataset.animating = '1';
    var split = new SplitText(title, { type: 'words,chars', charsClass: 'char' });
    var tl = gsap.timeline({
      defaults: { ease: 'expo.out' },
      // Al terminar se deshace el troceado: el panel reescribe el titular en vivo.
      onComplete: function () {
        split.revert();
        delete title.dataset.animating;
        title.dispatchEvent(new Event('intro-done'));
      },
    });
    tl.from(split.chars, { opacity: 0, y: 60, rotateX: -70, transformOrigin: '50% 100% -40', stagger: .022, duration: .8 })
      .from(hero.querySelectorAll('.eyebrow'), { opacity: 0, y: 12, duration: .6 }, 0)
      .from(hero.querySelectorAll('.status-lead'), { opacity: 0, y: 20, duration: .7 }, '-=.5')
      .from(hero.querySelectorAll('.hero-actions > *, .steps > li, .can-do'), { opacity: 0, y: 24, duration: .7, stagger: .07, clearProps: 'opacity,transform' }, '-=.45')
      .from(hero.querySelectorAll('.tv, .tv-bar'), { opacity: 0, scale: .82, duration: 1.1, clearProps: 'opacity,transform' }, .1)
      .from(hero.querySelectorAll('.remote'), { opacity: 0, y: 60, rotate: 4, duration: 1.1, clearProps: 'opacity,transform' }, .25);
  };

  var sectionsDone = false;
  api.sections = function () {
    if (sectionsDone || reduced) { ScrollTrigger.refresh(); return; }
    sectionsDone = true;
    gsap.matchMedia().add(
      { reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' },
      function (context) {
        if (context.conditions.reduced) return;

        document.querySelectorAll('[data-reveal]').forEach(function (sec) {
          var copy = sec.querySelectorAll('.sec-head p, .sec-head .sec-actions');
          gsap.fromTo(copy, { opacity: 0, y: 70 }, {
            opacity: 1, y: 0, ease: 'none', stagger: .12,
            scrollTrigger: { trigger: sec, start: 'clamp(top 88%)', end: 'clamp(top 35%)', scrub: .7 },
          });
          var blocks = Array.prototype.filter.call(sec.children, function (el) { return !el.classList.contains('sec-head'); });
          gsap.fromTo(blocks, { opacity: 0, y: 90, scale: .88, rotate: -1.5 }, {
            opacity: 1, y: 0, scale: 1, rotate: 0, ease: 'none', stagger: .06,
            scrollTrigger: { trigger: sec, start: 'clamp(top 92%)', end: 'clamp(top 55%)', scrub: .7 },
          });
        });

        document.querySelectorAll('.sec .split-title').forEach(function (h) {
          var s = new SplitText(h, { type: 'words,chars', charsClass: 'char' });
          gsap.from(s.chars, {
            opacity: 0, y: 40, rotateX: -70, transformOrigin: '50% 100% -20', stagger: .018, duration: .7, ease: 'expo.out',
            scrollTrigger: { trigger: h, start: 'clamp(top 88%)' },
          });
        });

        // Cortina: los medidores de memoria y disco se descubren de izquierda a derecha.
        var bar = document.getElementById('meters');
        if (bar) {
          gsap.fromTo(bar, { clipPath: 'inset(0 100% 0 0)' }, {
            clipPath: 'inset(0 0% 0 0)', ease: 'power3.out',
            scrollTrigger: { trigger: bar, start: 'clamp(top 90%)', end: 'clamp(top 55%)', scrub: .6 },
          });
        }
      }
    );
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  };

  document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
