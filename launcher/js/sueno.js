/* Salvapantallas con el estilo de la pantalla de inicio: hora con segundero, fecha, tiempo por horas y tarjetas de
   cristal con lo que echan en tus canales y tus próximos avisos (o el sol si no hay avisos). Todo el conjunto se
   desplaza unos píxeles cada minuto para no marcar la pantalla. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const stage = $('stage'), sueno = $('sueno');
  const dos = n => String(n).padStart(2, '0');
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const leer = c => { try { return JSON.parse(localStorage.getItem(c)); } catch (e) { return null; } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uso = n => `<svg><use href="#i-${n}"/></svg>`;
  const hhmm = d => `${dos(d.getHours())}:${dos(d.getMinutes())}`;

  // Mismos canales que la tarjeta «En directo», solo de apps instaladas.
  const CANALES = [
    ['La 1 HD', 'com.rtve.androidtv'], ['Antena 3 HD', 'com.antena3.atresplayer.tv'],
    ['La Sexta HD', 'com.antena3.atresplayer.tv'], ['Movistar Plus HD', 'com.movistarplus.androidtv'],
  ];

  document.documentElement.classList.toggle('en-caja', Puente.nativo);

  function escala() {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 1080 * k) / 2}px) scale(${k})`;
  }
  addEventListener('resize', escala);
  escala();

  function hora() {
    const d = new Date();
    $('hm').textContent = hhmm(d);
    $('ss').textContent = dos(d.getSeconds());
    $('fecha').textContent = `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
  }

  function icono(cod, dia) {
    if (cod <= 1) return dia ? 'sol' : 'luna';
    if (cod === 2) return dia ? 'sol-nube' : 'luna-nube';
    if (cod === 3) return 'nube';
    if (cod <= 48) return 'niebla';
    if (cod <= 57) return 'llovizna';
    if (cod <= 67 || (cod >= 80 && cod <= 82)) return 'lluvia';
    if (cod <= 86) return 'nieve';
    return 'tormenta';
  }

  // El tiempo lo descarga la pantalla de inicio (horas en segundos Unix y desfase de la ciudad); aquí se lee.
  function tiempo() {
    const t = leer('home-tiempo'), lugar = leer('home-ciudad');
    if (!t || !t.datos || !t.datos.current) return;
    const w = t.datos, c = w.current, off = w.utc_offset_seconds || 0;
    const enLugar = s => new Date((s + off) * 1000);
    $('t-icono').setAttribute('href', '#i-' + icono(c.weather_code, c.is_day));
    $('t-temp').textContent = Math.round(c.temperature_2m) + '°';
    $('t-lugar').textContent = (lugar && lugar.nombre) || t.lugar || '';
    const h = w.hourly, ahoraS = Date.now() / 1000;
    if (h && Array.isArray(h.time) && typeof h.time[0] === 'number') {
      const i0 = Math.max(0, h.time.findIndex(s => s > ahoraS) - 1);
      let html = '';
      for (let n = 1; n <= 4; n++) {
        const i = i0 + n * 2;
        if (i >= h.time.length) break;
        html += `<li><p class="h">${dos(enLugar(h.time[i]).getUTCHours())} h</p>${uso(icono(h.weather_code[i], h.is_day[i]))}<p class="t">${Math.round(h.temperature_2m[i])}°</p></li>`;
      }
      $('t-horas').innerHTML = html;
      const d = w.daily;
      if (d && d.sunrise) {
        const hm = s => { const x = enLugar(s); return `${dos(x.getUTCHours())}:${dos(x.getUTCMinutes())}`; };
        $('sale').textContent = hm(d.sunrise[0]);
        $('pone').textContent = hm(d.sunset[0]);
        $('fila-sol').hidden = false;
      }
    }
    $('tiempo').hidden = false;
  }

  // Luna: fase y horas de salida y puesta (js/luna.js), para la ciudad elegida.
  function luna() {
    const t = leer('home-tiempo'), lugar = leer('home-ciudad') || { lat: 40.4168, lon: -3.7038 };
    const off = t && t.datos ? t.datos.utc_offset_seconds || 0 : null;
    const hm = d => {
      if (off === null) return hhmm(d);
      const x = new Date(d.valueOf() + off * 1000);
      return `${dos(x.getUTCHours())}:${dos(x.getUTCMinutes())}`;
    };
    const f = Luna.fase(new Date()), h = Luna.horas(new Date(), lugar.lat, lugar.lon);
    $('luna-luz').setAttribute('d', Luna.trazo(f));
    $('l-sale').textContent = h.sale ? hm(h.sale) : '—';
    $('l-pone').textContent = h.pone ? hm(h.pone) : '—';
    $('fase').textContent = f.nombre === 'Luna llena' ? `Luna llena, ${Math.round(f.ilum * 100)} % iluminada`
      : `${f.nombre}, ${Math.round(f.ilum * 100)} % · llena en ${f.diasLlena} ${f.diasLlena === 1 ? 'día' : 'días'}`;
  }

  // Igual que en el inicio: fuera el rótulo («DIRECTO 25/10/2026 T26/27 · …») que traen algunos títulos de la guía.
  const limpiaTitulo = t => t.replace(/^(EN )?DIRECTO:?\s*/i, '').replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*/, '')
    .replace(/^T\d+\/\d+\s*·?\s*/, '').trim() || t;

  async function canales() {
    const instaladas = new Set(Puente.apps().map(a => a.pkg));
    const ids = CANALES.filter(([, pkg]) => instaladas.has(pkg)).map(([c]) => c);
    if (!ids.length) return;
    let g = null;
    try { g = await Puente.guia(ids); } catch (e) { return; }
    if (!g || !g.canales) return;
    const ahora = Date.now() / 1000, logos = g.logos || {};
    const html = ids.map(c => {
      const p = (g.canales[c] || []).find(x => x.ini <= ahora && x.fin > ahora);
      if (!p) return '';
      const pc = Math.min(100, (ahora - p.ini) / (p.fin - p.ini) * 100);
      const marca = logos[c] ? `<img src="${esc(logos[c])}" alt="">` : `<span class="nom">${esc(c.replace(/ HD$/, ''))}</span>`;
      return `<li>${marca}<div><p>${esc(limpiaTitulo(p.titulo))}</p><div class="barra"><i style="width:${pc.toFixed(0)}%"></i></div></div></li>`;
    }).join('');
    $('canales').innerHTML = html;
    $('caja-canales').hidden = !html;
  }

  // Próximos avisos (los 3 primeros); si no hay, la tarjeta del sol.
  function avisos() {
    const ahora = Date.now() / 1000;
    const lista = Puente.avisos().filter(a => a.ini > ahora - 60).sort((a, b) => a.ini - b.ini).slice(0, 3);
    $('avisos').innerHTML = lista.map(a => `<li><b>${hhmm(new Date(a.ini * 1000))}</b><span>${esc(a.titulo)}, ${esc(a.nombre)}</span></li>`).join('');
    $('caja-avisos').hidden = !lista.length;
  }

  // Desplazamiento suave de unos píxeles alrededor del centro.
  function desplaza() {
    const x = Math.round((Math.random() - .5) * 60), y = Math.round((Math.random() - .5) * 40);
    sueno.style.transform = `translate(${x}px, ${y}px)`;
  }

  hora();
  tiempo();
  luna();
  avisos();
  canales();
  requestAnimationFrame(() => sueno.classList.add('ver'));

  setInterval(hora, 1000);
  setInterval(() => { desplaza(); tiempo(); luna(); avisos(); }, 60 * 1000);
  setInterval(canales, 5 * 60 * 1000);
})();
