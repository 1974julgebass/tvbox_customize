/* Pantalla de inicio: fila de apps arriba y, debajo, lo que ofrece la app enfocada: la guía de TV de sus
   canales (RTVE, Atresmedia, Movistar+) o lo último que se ha visto con ella. Al pie, tiempo, sol y luna y la caja.
   Mando: flechas, OK (Intro) y Atrás (Escape/Retroceso). En el PC vale el ratón: mover enfoca, el clic hace de OK
   y el derecho abre el menú. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const mueve = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Lienzo escalado a la ventana ---------- */
  function escala() {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 1080 * k) / 2}px) scale(${k})`;
  }
  addEventListener('resize', escala);
  escala();

  /* ---------- Utilidades ---------- */
  const dos = n => String(n).padStart(2, '0');
  const hhmm = d => `${dos(d.getHours())}:${dos(d.getMinutes())}`;
  const gb = b => (b / 1e9).toFixed(1).replace('.', ',') + ' GB';
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function duracion(seg) {
    const d = Math.floor(seg / 86400), h = Math.floor(seg % 86400 / 3600), m = Math.floor(seg % 3600 / 60);
    if (d) return `${d} d ${h} h`;
    if (h) return `${h} h ${dos(m)} min`;
    return `${m} min`;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const guarda = {
    leer(c) { try { return JSON.parse(localStorage.getItem(c)); } catch (e) { return null; } },
    poner(c, v) { try { localStorage.setItem(c, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  };
  const uso = n => `<svg><use href="#i-${n}"/></svg>`;

  /* ---------- Hora y saludo ---------- */
  function pintaHora() {
    const d = new Date(), h = d.getHours();
    $('hora').textContent = hhmm(d);
    $('fecha').textContent = `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
    $('saludo').textContent = h >= 6 && h < 13 ? 'Buenos días' : (h >= 13 && h < 21 ? 'Buenas tardes' : 'Buenas noches');
    // Modo noche: de 23:00 a 7:00 la pantalla se atenúa para no deslumbrar con la luz apagada.
    document.documentElement.classList.toggle('noche', h >= 23 || h < 7);
    if (typeof pintaTemporizador === 'function') pintaTemporizador();
  }

  /* ---------- Tiempo (Open-Meteo, sin clave) ---------- */
  const CIELO = {
    0: 'Despejado', 1: 'Casi despejado', 2: 'Intervalos nubosos', 3: 'Cubierto',
    45: 'Niebla', 48: 'Niebla con escarcha',
    51: 'Llovizna débil', 53: 'Llovizna', 55: 'Llovizna intensa', 56: 'Llovizna helada', 57: 'Llovizna helada',
    61: 'Lluvia débil', 63: 'Lluvia', 65: 'Lluvia fuerte', 66: 'Lluvia helada', 67: 'Lluvia helada fuerte',
    71: 'Nieve débil', 73: 'Nieve', 75: 'Nieve fuerte', 77: 'Granizo fino',
    80: 'Chubascos débiles', 81: 'Chubascos', 82: 'Chubascos fuertes', 85: 'Chubascos de nieve', 86: 'Chubascos de nieve',
    95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo',
  };
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

  // Ciudad del tiempo: se elige en Ajustes. Las horas llegan en segundos Unix y se pasan a la hora de esa ciudad.
  const CIUDAD_DEFECTO = { nombre: 'Madrid', lat: 40.4168, lon: -3.7038, zona: 'Comunidad de Madrid' };
  let lugar = guarda.leer('home-ciudad') || CIUDAD_DEFECTO;
  let tiempo = guarda.leer('home-tiempo');
  if (tiempo && tiempo.lugar !== lugar.nombre) tiempo = null; // caché de otra ciudad o de la versión anterior

  const enLugar = s => new Date((s + tiempo.datos.utc_offset_seconds) * 1000); // usar con getUTC*
  const hhmmL = s => { const d = enLugar(s); return `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`; };

  async function cargaTiempo() {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lugar.lat + '&longitude=' + lugar.lon +
      '&current=temperature_2m,apparent_temperature,weather_code,is_day' +
      '&hourly=temperature_2m,weather_code,precipitation_probability,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset' +
      '&timezone=auto&timeformat=unixtime&forecast_days=2';
    const pedido = lugar.nombre;
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const datos = await r.json();
      if (pedido !== lugar.nombre) return; // se cambió de ciudad mientras tanto
      tiempo = { datos, ts: Date.now(), lugar: pedido };
      guarda.poner('home-tiempo', tiempo);
    } catch (e) {
      // Sin red: se queda con lo último guardado.
    }
    pintaTiempo();
  }

  function pintaTiempo() {
    $('ahora-lugar').textContent = lugar.nombre;
    if (!tiempo) {
      $('ahora-cielo').textContent = 'Sin datos: la caja no tiene internet';
      return;
    }
    const w = tiempo.datos, c = w.current;
    const ico = '#i-' + icono(c.weather_code, c.is_day);
    $('ahora-temp').textContent = Math.round(c.temperature_2m);
    $('ahora-icono').setAttribute('href', ico);
    $('mini-icono').setAttribute('href', ico);
    $('mini-temp').textContent = Math.round(c.temperature_2m) + '°';
    $('ahora-cielo').textContent = `${CIELO[c.weather_code] || '—'}, sensación de ${Math.round(c.apparent_temperature)}°`;

    // Cuatro tomas cada dos horas a partir de la siguiente hora (cuatro caben con letra legible desde el sofá).
    const h = w.hourly, ahoraS = Date.now() / 1000;
    const i0 = Math.max(0, h.time.findIndex(s => s > ahoraS) - 1);
    let html = '';
    for (let n = 1; n <= 4; n++) {
      const i = i0 + n * 2;
      if (i >= h.time.length) break;
      html += `<li><p class="h">${dos(enLugar(h.time[i]).getUTCHours())} h</p>` +
        `${uso(icono(h.weather_code[i], h.is_day[i]))}<p class="t">${Math.round(h.temperature_2m[i])}°</p></li>`;
    }
    $('horas').innerHTML = html;

    let lluvia = -1;
    for (let i = i0; i < i0 + 12 && i < h.time.length; i++) if ((h.precipitation_probability[i] ?? 0) >= 40) { lluvia = i; break; }
    const d = w.daily;
    const txt = lluvia < 0 ? 'Sin lluvia en las próximas 12 horas'
      : `Lluvia probable hacia las ${dos(enLugar(h.time[lluvia]).getUTCHours())}:00`;
    $('lluvia').innerHTML = `${txt}. Mañana, ${(CIELO[d.weather_code[1]] || '').toLowerCase()}: <b>${Math.round(d.temperature_2m_max[1])}°</b> / ${Math.round(d.temperature_2m_min[1])}°`;

    pintaSol();
  }

  // Sol: franja de luz del día a escala de 24 h, en la hora de la ciudad.
  function pintaSol() {
    if (!tiempo) return;
    const d = tiempo.datos.daily, ahoraS = Date.now() / 1000;
    const sale = d.sunrise[0], pone = d.sunset[0];
    $('sale').textContent = hhmmL(sale);
    $('pone').textContent = hhmmL(pone);
    const pc = s => { const x = enLugar(s); return (x.getUTCHours() * 60 + x.getUTCMinutes()) / 1440 * 100; };
    $('franja-luz').style.left = pc(sale) + '%';
    $('franja-luz').style.width = (pc(pone) - pc(sale)) + '%';
    $('franja-ahora').style.left = pc(ahoraS) + '%';
    let txt;
    if (ahoraS < sale) txt = `Amanece en <b>${duracion(sale - ahoraS)}</b>`;
    else if (ahoraS < pone) txt = `Quedan <b>${duracion(pone - ahoraS)}</b> de luz`;
    else txt = `Mañana amanece a las <b>${hhmmL(d.sunrise[1])}</b>`;
    $('luz').innerHTML = txt;
    pintaLuna(); // sus horas van en la hora de la ciudad, que acaba de llegar con el tiempo
  }

  /* ---------- Luna: fase calculada en local ---------- */
  function pintaLuna() {
    // Fase y horas de salida y puesta calculadas en local (js/luna.js), en la hora de la ciudad elegida.
    const f = Luna.fase(new Date());
    $('luna-texto').textContent = f.nombre === 'Luna llena' ? `Llena, ${Math.round(f.ilum * 100)} %`
      : `${f.nombre.replace(/^Luna /, '').replace(/^./, c => c.toUpperCase())}, ${Math.round(f.ilum * 100)} %`;
    $('luna-luz').setAttribute('d', Luna.trazo(f));
    const h = Luna.horas(new Date(), lugar.lat, lugar.lon);
    const hm = d => (tiempo ? hhmmL(d.valueOf() / 1000) : hhmm(d));
    // Flechas propias de la luna (las del horizonte son del sol y se leían como horas del sol).
    $('luna-horas').innerHTML = (h.sale ? `${uso('sube')}${hm(h.sale)}` : '') + (h.pone ? `${uso('baja')}${hm(h.pone)}` : '');
  }

  /* ---------- Estado de la caja ---------- */
  function pintaCaja() {
    const e = Puente.estado();
    if (!e) return;
    if (e.wifi) {
      const cls = e.wifi.rssi > -67 ? 'ok' : (e.wifi.rssi < -75 ? 'mal' : 'regular');
      const txt = cls === 'ok' ? 'Buena' : (cls === 'mal' ? 'Floja' : 'Regular');
      $('c-wifi').innerHTML = `<span class="${cls}">${txt}</span> <small>${e.wifi.mbps} Mbps</small>`;
    }
    if (e.ram) $('c-ram').innerHTML = `${Math.round((1 - e.ram.libre / e.ram.total) * 100)} % <small>en uso</small>`;
    if (e.disco) {
      // Poco espacio: menos del 15 % o de 800 MB. Se avisa una vez al día y se dice dónde liberarlo.
      const poco = e.disco.libre / e.disco.total < .15 || e.disco.libre < 800e6;
      $('c-disco').innerHTML = `<span class="${poco ? 'mal' : ''}">${gb(e.disco.libre)}</span>${poco ? ' <small>poco</small>' : ''}`;
      const hoy = new Date().toDateString();
      if (poco && guarda.leer('home-aviso-espacio') !== hoy) {
        guarda.poner('home-aviso-espacio', hoy);
        setTimeout(() => aviso('Queda poco espacio. Ajustes → Liberar espacio'), 3000);
      }
    }
    if (e.encendida) $('c-uptime').textContent = duracion(e.encendida);
  }

  /* ---------- Qué enseña cada app en la segunda fila ---------- */
  // Canales de la guía (ids de la guía XMLTV) para las apps de televisión.
  const CANALES = {
    'com.rtve.androidtv': ['La 1 HD', 'La 2', '24 Horas', 'Clan', 'Teledeporte'],
    'com.antena3.atresplayer.tv': ['Antena 3 HD', 'La Sexta HD', 'Neox', 'Nova', 'Mega', 'Atreseries'],
    'com.movistarplus.androidtv': ['Movistar Plus HD', 'M+ Estrenos HD', 'M+ Originales HD', 'M+ Vamos HD', 'M+ LaLiga HD', 'M+ Documentales HD'],
  };
  // «En directo»: los canales principales de todas las apps de TV instaladas, en este orden.
  const PRINCIPALES = ['La 1 HD', 'Antena 3 HD', 'La Sexta HD', 'Movistar Plus HD', 'La 2', 'M+ Vamos HD',
    'M+ LaLiga HD', '24 Horas', 'Teledeporte', 'M+ Estrenos HD', 'Neox', 'Nova', 'Clan'];
  const GENERO = [
    [/^movie|film/i, 'Cine'], [/news|current affairs/i, 'Informativo'], [/sport/i, 'Deportes'],
    [/child|cartoon|youth/i, 'Infantil'], [/documentar/i, 'Documental'], [/music/i, 'Música'],
    [/series|soap|drama/i, 'Serie'], [/talk|discussion/i, 'Tertulia'], [/show|game|variety|entertainment|leisure/i, 'Entretenimiento'],
    [/art|culture/i, 'Cultura'], [/educa|science/i, 'Divulgación'],
  ];
  const genero = cat => (GENERO.find(([re]) => re.test(cat || '')) || [null, ''])[1];
  const nombreCanal = id => id.replace(/ HD$/, '');

  // Por filas de cinco: lo del día a día arriba, el móvil y las apps en medio, Android y el apagado al final
  // (el foco entra en la primera, nunca en Reiniciar).
  const ACCIONES = [
    { tipo: 'accion', accion: 'temporizador', nombre: 'Temporizador', icono: 'reloj', texto: 'Apaga la caja dentro de un rato' },
    { tipo: 'accion', accion: 'palabras', nombre: 'Avisos automáticos', icono: 'campana', texto: 'Te avisa cuando echen lo que te gusta' },
    { tipo: 'accion', accion: 'ciudad', nombre: 'Ciudad', icono: 'sitio', texto: 'De qué ciudad es el tiempo de la pantalla' },
    { tipo: 'accion', accion: 'movil', nombre: 'Usar el móvil', icono: 'movil', texto: 'Empareja tu móvil para usarlo de mando' },
    { tipo: 'accion', accion: 'moviles', nombre: 'Móviles emparejados', icono: 'moviles', texto: 'Ver y quitar los móviles que hacen de mando' },
    { tipo: 'accion', accion: 'instalar', nombre: 'Instalar app', icono: 'instalar', texto: 'Instala un .apk del pendrive o de Descargas' },
    { tipo: 'accion', accion: 'apps', nombre: 'Apps instaladas', icono: 'lista', texto: 'Borrar datos, permisos y desinstalar' },
    { tipo: 'accion', accion: 'espacio', nombre: 'Liberar espacio', icono: 'escoba', texto: 'Borrar los datos en caché de las apps' },
    { tipo: 'accion', accion: 'wifi', nombre: 'Wifi y red', icono: 'wifi', texto: 'Redes y conexión' },
    { tipo: 'accion', accion: 'ajustes', nombre: 'Ajustes de Android', icono: 'deslizadores', texto: 'Pantalla, sonido, mando y cuentas' },
    { tipo: 'accion', accion: 'reposo', nombre: 'Apagar (reposo)', icono: 'luna', texto: 'Apaga la caja y la pantalla; el mando la enciende' },
    { tipo: 'accion', accion: 'apagar', nombre: 'Reiniciar', icono: 'apagar', texto: 'Abre el menú del botón de encendido: reiniciar o captura' },
  ];
  const DIRECTO = { tipo: 'directo', nombre: 'En directo', color: '#E5484D' };
  const SEGUIR = { tipo: 'seguir', nombre: 'Seguir viendo', color: '#5B8CFF' };
  // Canales que su app sabe abrir en directo con un enlace (comprobado en la caja). El resto abre la app.
  const ENLACES = {
    'Antena 3 HD': 'https://www.atresplayer.com/directos/antena3/',
    'La Sexta HD': 'https://www.atresplayer.com/directos/lasexta/',
    'Neox': 'https://www.atresplayer.com/directos/neox/',
    'Nova': 'https://www.atresplayer.com/directos/nova/',
    'Mega': 'https://www.atresplayer.com/directos/mega/',
    'Atreseries': 'https://www.atresplayer.com/directos/atreseries/',
  };
  const BUSCAR = { tipo: 'buscar', nombre: 'Buscar en YouTube' };
  const TODAS = { tipo: 'todas', nombre: 'Todas las apps' };
  const AJUSTES = { tipo: 'ajustes', nombre: 'Ajustes' };

  let apps = [];
  const guias = new Map(); // pkg o 'directo' → { ts, datos }
  const est = { zona: 'apps', idx: 0, cidx: 0, oidx: 0, dock: [], otras: [], cont: [], hojaItems: [], hojaIdx: 0, desp: { dock: 0, cont: 0, otras: 0 } };
  const dockEl = $('dock'), contEl = $('cont'), otrasEl = $('otras'), hojaEl = $('hoja'), rejilla = $('hoja-rejilla');

  function cuando(ts) {
    if (!ts) return 'Sin estrenar';
    const d = new Date(ts), hoy = new Date();
    const dias = Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    if (dias === 0) return `hoy a las ${hhmm(d)}`;
    if (dias === 1) return `ayer a las ${hhmm(d)}`;
    if (dias < 7) return `el ${DIAS[d.getDay()]}`;
    return `hace ${dias} días`;
  }

  // Tarjetas propias: icono y nombre corto dentro, para que se reconozcan sin tener que enfocarlas.
  const ICONO_TILE = {
    todas: ['todas', 'Todas'], ajustes: ['ajustes', 'Ajustes'], directo: ['directo', 'En directo'], buscar: ['buscar', 'Buscar'],
    seguir: ['seguir', 'Seguir viendo'],
  };
  function tileHtml(it) {
    const propia = ICONO_TILE[it.tipo];
    if (propia) {
      return `<div class="tile tile-cristal cristal${it.tipo === 'directo' ? ' tile-directo' : ''}">` +
        `${uso(propia[0])}<span class="tile-txt">${propia[1]}</span></div>`;
    }
    if (it.tipo === 'accion') return `<div class="tile tile-cristal cristal">${uso(it.icono)}</div>`;
    if (it.banner) return `<div class="tile"><img src="${esc(it.banner)}" alt=""></div>`;
    return `<div class="tile tile-app" style="--c:${esc(it.color)}"><span class="tile-marca">${esc(it.nombre)}</span></div>`;
  }

  // Arriba solo las apps que tienen algo que enseñar (guía de TV o historial); el resto va a la tercera fila.
  const CON_HISTORIAL = new Set(['com.google.android.youtube.tv', 'com.filmin.androidtv']);
  const daInfo = a => !!CANALES[a.pkg] || CON_HISTORIAL.has(a.pkg) || Puente.historial(a.pkg).length > 0;
  const instalada = pkg => apps.some(a => a.pkg === pkg);

  let favoritas = [], ocultas = new Set();

  function pintaDock() {
    const porPkg = new Map(apps.map(a => [a.pkg, a]));
    const favs = favoritas.filter(p => !ocultas.has(p)).map(p => porPkg.get(p)).filter(Boolean);
    const hayTele = Object.keys(CANALES).some(instalada);
    est.dock = (hayTele ? [DIRECTO] : []).concat(seguirViendo().length ? [SEGUIR] : [], favs.filter(daInfo));
    est.otras = favs.filter(a => !daInfo(a)).concat(instalada('com.google.android.youtube.tv') ? [BUSCAR] : [], [TODAS, AJUSTES]);
    const li = (it, i) => `<li data-i="${i}">${tileHtml(it)}<span class="tile-nombre">${esc(it.nombre)}</span></li>`;
    dockEl.innerHTML = est.dock.map(li).join('');
    otrasEl.innerHTML = est.otras.map(li).join('');
    est.idx = Math.min(est.idx, est.dock.length - 1);
    est.oidx = Math.min(est.oidx, est.otras.length - 1);
  }

  // «Seguir viendo»: lo último de todas las apps instaladas, lo más reciente primero.
  function seguirViendo() {
    const lista = [];
    for (const a of apps) for (const h of Puente.historial(a.pkg)) lista.push(Object.assign({ app: a }, h));
    return lista.sort((x, y) => y.ts - x.ts).slice(0, 12);
  }

  // Canales que enseña un elemento de la primera fila: [{ canal, pkg }].
  function canalesDe(it) {
    if (it.tipo === 'directo') {
      const de = {};
      for (const [pkg, lista] of Object.entries(CANALES)) if (instalada(pkg)) lista.forEach(c => { de[c] = pkg; });
      return PRINCIPALES.filter(c => de[c]).map(c => ({ canal: c, pkg: de[c] }));
    }
    return (CANALES[it.pkg] || []).map(c => ({ canal: c, pkg: it.pkg }));
  }

  /* Tarjetas de la segunda fila */
  let avisos = [];
  const idAviso = (canal, ini) => canal + '|' + ini;
  const tieneAviso = (canal, ini) => avisos.some(a => a.id === idAviso(canal, ini));

  // Logo y nombre del canal: el logo solo no se distingue desde el sofá (los de M+ llevan el nombre en letra mínima).
  function cabCanal(canal, logo) {
    return (logo ? `<img class="t-logo" src="${esc(logo)}" alt="">` : '') + `<span class="t-nombre">${esc(nombreCanal(canal))}</span>`;
  }
  // La guía trae títulos de rótulo («DIRECTO 25/10/2026 T26/27 · DeportePlus»): se quita la parte que no dice nada.
  const limpiaTitulo = t => t.replace(/^(EN )?DIRECTO:?\s*/i, '').replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*/, '')
    .replace(/^T\d+\/\d+\s*·?\s*/, '').trim() || t;
  function tarjetaGuia(canal, progs, ahoraS, logo) {
    const i = progs.findIndex(p => p.ini <= ahoraS && p.fin > ahoraS);
    const ya = progs[i], luego = progs[i + 1];
    if (!ya) {
      return `<div class="tarjeta cristal"><p class="t-canal">${cabCanal(canal, logo)}</p>` +
        `<p class="t-hora t-sin">Sin programación ahora mismo</p></div>`;
    }
    const pc = Math.min(100, Math.max(0, (ahoraS - ya.ini) / (ya.fin - ya.ini) * 100));
    const g = genero(ya.cat);
    const campana = luego && tieneAviso(canal, luego.ini) ? `<svg class="t-campana"><use href="#i-campana"/></svg>` : '';
    return `<div class="tarjeta cristal">
      <p class="t-canal">${cabCanal(canal, logo)}</p>
      <p class="t-titulo">${esc(limpiaTitulo(ya.titulo))}</p>
      <p class="t-hora">${hhmm(new Date(ya.ini * 1000))} – ${hhmm(new Date(ya.fin * 1000))}${g ? ', ' + g.toLowerCase() : ''}</p>
      <div class="barra"><i style="width:${pc.toFixed(1)}%"></i></div>
      <p class="t-despues">${campana}${luego ? `${hhmm(new Date(luego.ini * 1000))} <b>${esc(limpiaTitulo(luego.titulo))}</b>` : 'Fin de la emisión'}</p>
    </div>`;
  }
  function tarjetaHist(h, app, conApp) {
    // progreso -1: la app no dice cuánto dura, así que no hay barra.
    const aMedias = h.progreso > 0 && h.progreso < .97;
    return `<div class="tarjeta cristal tarjeta-hist">
      <div class="t-portada" style="--c:${esc(app.color)}">${uso('play')}${conApp ? `<span class="t-app">${esc(app.nombre)}</span>` : ''}</div>
      <p class="t-titulo">${esc(h.titulo)}</p>
      <p class="t-hora">${aMedias ? 'Lo dejaste' : 'Visto'} ${cuando(h.ts)}${esc(h.sub ? ' · ' + h.sub : '')}</p>
      ${aMedias ? `<div class="barra"><i style="width:${Math.round(h.progreso * 100)}%"></i></div>` : ''}
    </div>`;
  }
  function tarjetaVacia(titulo, texto) {
    return `<div class="tarjeta cristal tarjeta-vacia"><p class="t-titulo">${esc(titulo)}</p><p class="t-hora">${esc(texto)}</p></div>`;
  }

  let pide = 0;
  function pintaContenido(it) {
    const box = document.querySelector('.contenido');
    const yo = ++pide;
    let titulo = it.nombre, sub = '', items = [], html = '';
    const canales = canalesDe(it);

    if (canales.length) {
      sub = it.tipo === 'directo' ? 'Lo que echan ahora en tus canales' : 'Ahora en directo';
      const clave = it.pkg || it.tipo, g = guias.get(clave);
      if (g) {
        // La guía guardada se enseña ya; si tiene más de 5 minutos se renueva sin que se note.
        const ahoraS = Date.now() / 1000, logos = g.datos.logos || {};
        items = canales.map(c => ({ tipo: 'canal', pkg: c.pkg, canal: c.canal, progs: g.datos.canales[c.canal] || [], logo: logos[c.canal] }));
        html = items.map((c, i) => `<li data-i="${i}">${tarjetaGuia(c.canal, c.progs, ahoraS, c.logo)}</li>`).join('');
      } else {
        items = [{ tipo: 'app', pkg: canales[0].pkg }];
        html = `<li data-i="0">${tarjetaVacia('Cargando la guía…', 'Programación de hoy de sus canales.')}</li>`;
      }
      if (!g || Date.now() - g.ts > 5 * 60 * 1000) {
        Puente.guia(canales.map(c => c.canal)).then(datos => {
          if (!datos || !datos.canales) throw new Error('sin guía');
          guias.set(clave, { ts: Date.now(), datos });
          if (yo === pide && est.zona !== 'cont') pintaContenido(it);
        }).catch(() => {
          if (yo !== pide || g) return; // con una guía guardada se sigue enseñando esa
          contEl.innerHTML = `<li data-i="0">${tarjetaVacia('No se ha podido cargar la guía',
            'Comprueba que la caja tiene internet. Lo vuelvo a intentar cuando vuelvas a esta app.')}</li>`;
        });
      }
    } else if (it.tipo === 'seguir') {
      const todo = seguirViendo();
      sub = 'Lo último de todas tus apps';
      items = todo.map(h => ({ tipo: 'app', pkg: h.app.pkg }));
      html = todo.map((h, i) => `<li data-i="${i}">${tarjetaHist(h, h.app, true)}</li>`).join('');
    } else {
      const hist = Puente.historial(it.pkg);
      if (hist.length) {
        sub = 'Lo último que has visto';
        items = hist.map(h => ({ tipo: 'app', pkg: it.pkg }));
        html = hist.map((h, i) => `<li data-i="${i}">${tarjetaHist(h, it)}</li>`).join('');
      } else {
        sub = it.ultimo ? `Abierta ${cuando(it.ultimo)}` : 'Sin estrenar';
        items = [{ tipo: 'app', pkg: it.pkg }];
        html = `<li data-i="0">${tarjetaVacia(`Aún no has visto nada con ${it.nombre}`, 'Cuando reproduzcas algo, aparecerá aquí para seguir donde lo dejaste.')}</li>`;
      }
    }

    const cambiaApp = $('cont-titulo').textContent !== titulo;
    $('cont-titulo').textContent = titulo;
    $('cont-sub').textContent = sub;
    contEl.innerHTML = html;
    est.cont = items;
    est.cidx = Math.min(est.cidx, items.length - 1);
    if (cambiaApp) { est.cidx = 0; est.desp.cont = 0; contEl.style.transform = 'translateX(0)'; }
    if (cambiaApp && mueve) { box.classList.remove('cambia'); void box.offsetWidth; box.classList.add('cambia'); }
    marca();
  }

  /* Luz del color de la app: dos capas que se funden con opacidad (barato en la caja; repintar degradados no lo es). */
  let capa = 0;
  function ambiente(color) {
    const c = color || '#2B3340';
    stage.style.setProperty('--app', c);
    const sube = capa ? 'a' : 'b', baja = capa ? 'b' : 'a';
    for (const [id, on] of [['amb-' + sube, true], ['amb-' + baja, false], ['man-' + sube, true], ['man-' + baja, false]]) {
      const el = $(id);
      if (on) { el.style.setProperty('--amb', c); el.style.setProperty('--app', c); }
      el.classList.toggle('on', on);
    }
    capa = 1 - capa;
  }

  /* Foco */
  function desplaza(el, li, clave) {
    const izq = li.offsetLeft, der = izq + li.offsetWidth;
    let d = est.desp[clave];
    if (der - d > 1920 - 96) d = der - (1920 - 96);
    if (izq - d < 96) d = Math.max(0, izq - 96);
    est.desp[clave] = d;
    el.style.transform = `translateX(${-d}px)`;
  }
  function marca() {
    [...dockEl.children].forEach((li, n) => {
      li.classList.toggle('foco', est.zona === 'apps' && n === est.idx);
      li.classList.toggle('elegida', est.zona !== 'apps' && n === est.idx);
    });
    [...contEl.children].forEach((li, n) => li.classList.toggle('foco', est.zona === 'cont' && n === est.cidx));
    [...otrasEl.children].forEach((li, n) => li.classList.toggle('foco', est.zona === 'otras' && n === est.oidx));
    if (dockEl.children[est.idx]) desplaza(dockEl, dockEl.children[est.idx], 'dock');
    if (contEl.children[est.cidx]) desplaza(contEl, contEl.children[est.cidx], 'cont');
    if (otrasEl.children[est.oidx]) desplaza(otrasEl, otrasEl.children[est.oidx], 'otras');
  }
  function enfocaOtra(i) {
    est.oidx = Math.max(0, Math.min(est.otras.length - 1, i));
    est.zona = 'otras';
    marca();
  }

  let espera = 0;
  function enfocaApp(i) {
    const antes = est.idx;
    est.idx = Math.max(0, Math.min(est.dock.length - 1, i));
    est.zona = 'apps';
    marca();
    if (antes === est.idx && $('cont-titulo').textContent.trim()) return;
    const it = est.dock[est.idx];
    ambiente(it.color);
    // Un respiro antes de cargar la segunda fila, para que pasar rápido por las apps no dispare la guía de todas.
    clearTimeout(espera);
    espera = setTimeout(() => pintaContenido(it), 140);
  }
  function enfocaCont(i) {
    if (!est.cont.length) return;
    est.cidx = Math.max(0, Math.min(est.cont.length - 1, i));
    est.zona = 'cont';
    marca();
  }

  /* Hojas */
  const COLS = 5;
  function abreHoja(tipo, foco) {
    est.hoja = tipo;
    if (tipo === 'todas') {
      // Las ocultas, al final y apagadas: desde aquí se pueden volver a mostrar.
      const orden = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
      est.hojaItems = apps.filter(a => !ocultas.has(a.pkg)).sort(orden)
        .concat(apps.filter(a => ocultas.has(a.pkg)).sort(orden));
    } else {
      est.hojaItems = ACCIONES;
    }
    $('hoja-titulo').textContent = tipo === 'todas' ? 'Todas las apps' : 'Ajustes';
    rejilla.innerHTML = est.hojaItems.map((it, i) => {
      const marcas = (ocultas.has(it.pkg) ? ' oculta' : '') + (favoritas.includes(it.pkg) && !ocultas.has(it.pkg) ? ' en-inicio' : '');
      return `<li class="item${marcas}" data-i="${i}">${tileHtml(it)}<span class="item-nombre">${esc(it.nombre)}</span></li>`;
    }).join('');
    hojaEl.hidden = false;
    if (est.zona !== 'hoja') est.zonaPrevia = est.zona;
    est.zona = 'hoja';
    enfocaHoja(foco || 0);
  }
  function cierraHoja() {
    est.hoja = null;
    hojaEl.hidden = true;
    est.zona = est.zonaPrevia || 'apps';
    marca();
  }
  // Páginas de 3 filas: al pasar de la última fila se ve la página siguiente entera; nunca se sale del marco.
  const FILAS_PAGINA = 3;
  function enfocaHoja(i) {
    est.hojaIdx = Math.max(0, Math.min(est.hojaItems.length - 1, i));
    [...rejilla.children].forEach((li, n) => {
      li.classList.toggle('foco', n === est.hojaIdx);
      li.firstElementChild.classList.toggle('foco', n === est.hojaIdx);
    });
    const lis = rejilla.children;
    const paso = lis[COLS] ? lis[COLS].offsetTop - lis[0].offsetTop : 0; // alto de una fila con su hueco
    const paginas = Math.ceil(Math.ceil(est.hojaItems.length / COLS) / FILAS_PAGINA);
    const pagina = Math.floor(Math.floor(est.hojaIdx / COLS) / FILAS_PAGINA);
    rejilla.style.transform = `translateY(${-pagina * FILAS_PAGINA * paso}px)`;
    $('hoja-pagina').textContent = paginas > 1 ? `Página ${pagina + 1} de ${paginas}` : '';
    // Qué hace el ajuste enfocado; en «Todas», qué significa el punto verde.
    const it = est.hojaItems[est.hojaIdx];
    $('hoja-ayuda').innerHTML = est.hoja === 'ajustes' ? esc(it && it.texto || '')
      : '<i class="punto"></i> En la pantalla de inicio · OK para abrir, mover u ocultar';
  }

  // OK sobre algo. Una app de las filas o de «Todas» abre su menú (con «Abrir» marcado); un canal abre el suyo
  // (ver o avisarme); lo visto se abre directamente.
  function activa(it, el) {
    if (!it) return;
    if (it.tipo === 'todas') return abreHoja('todas');
    if (it.tipo === 'ajustes') return abreHoja('ajustes');
    if (it.tipo === 'buscar') return abreBusca();
    if (it.tipo === 'directo' || it.tipo === 'seguir') return enfocaCont(est.cidx);
    if (it.tipo === 'accion' && it.accion === 'ciudad') return abreCiudad();
    if (it.tipo === 'accion' && it.accion === 'temporizador') return abreMenuTemporizador();
    if (it.tipo === 'accion' && it.accion === 'palabras') return abrePalabras();
    if (it.tipo === 'accion' && it.accion === 'movil') return abreQR();
    if (it.tipo === 'accion' && it.accion === 'moviles') return abreMenuMoviles();
    if (it.tipo === 'accion' && it.accion === 'instalar') return abreInstalar();
    if (it.tipo === 'accion') return Puente.sistema(it.accion);
    if (it.tipo === 'canal') return abreMenuCanal(it);
    if (!it.tipo && appEnfocada() === it) return abreMenuApp();
    if (it.pkg) lanzaApp(it.pkg, el);
  }

  /* ---------- Ciudad del tiempo: buscar con el teclado de la tele o elegir de la lista ---------- */
  const ciudadEl = $('ciudad'), ciudadTexto = $('ciudad-texto'), ciudadLista = $('ciudad-lista'), ciudadCaja = $('ciudad-caja');
  const SUGERIDAS = [
    CIUDAD_DEFECTO,
    { nombre: 'Barcelona', lat: 41.3874, lon: 2.1686, zona: 'Cataluña' },
    { nombre: 'Valencia', lat: 39.4699, lon: -0.3763, zona: 'Comunidad Valenciana' },
    { nombre: 'Sevilla', lat: 37.3891, lon: -5.9845, zona: 'Andalucía' },
    { nombre: 'Zaragoza', lat: 41.6488, lon: -0.8891, zona: 'Aragón' },
    { nombre: 'Málaga', lat: 36.7213, lon: -4.4214, zona: 'Andalucía' },
    { nombre: 'Bilbao', lat: 43.2630, lon: -2.9350, zona: 'País Vasco' },
  ];
  let buscaT = 0;

  function sugeridas() {
    // La ciudad actual siempre la primera, aunque no esté en la lista.
    return [lugar].concat(SUGERIDAS.filter(c => c.nombre !== lugar.nombre));
  }
  function abreCiudad() {
    est.ciudad = { items: sugeridas(), idx: -1 };
    ciudadTexto.value = '';
    $('ciudad-estado').textContent = 'Elige una o escribe para buscar';
    pintaCiudades();
    ciudadEl.hidden = false;
    enfocaCiudad(-1);
  }
  function cierraCiudad() {
    est.ciudad = null;
    clearTimeout(buscaT);
    ciudadTexto.blur();
    ciudadEl.hidden = true;
  }
  function pintaCiudades() {
    ciudadLista.innerHTML = est.ciudad.items.map((c, i) =>
      `<li data-i="${i}" class="${c.nombre === lugar.nombre && c.lat === lugar.lat ? 'actual' : ''}">${uso('sitio')}` +
      `<span>${esc(c.nombre)}</span><small>${esc(c.zona || '')}</small></li>`).join('');
  }
  // -1 es la caja de texto; 0.. las ciudades.
  function enfocaCiudad(i) {
    const c = est.ciudad;
    c.idx = Math.max(-1, Math.min(c.items.length - 1, i));
    ciudadCaja.classList.toggle('foco', c.idx === -1);
    [...ciudadLista.children].forEach((li, n) => li.classList.toggle('foco', n === c.idx));
    if (c.idx !== -1 && document.activeElement === ciudadTexto) ciudadTexto.blur();
  }
  async function buscaCiudad() {
    const q = ciudadTexto.value.trim(), estado = $('ciudad-estado');
    if (!est.ciudad) return;
    if (q.length < 2) {
      est.ciudad.items = sugeridas();
      estado.textContent = 'Elige una o escribe para buscar';
      pintaCiudades();
      return;
    }
    estado.textContent = 'Buscando…';
    try {
      const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=8&language=es&format=json&name=' + encodeURIComponent(q));
      // Primero las de España (el buscador ordena por población y Toledo, Ohio, gana a Toledo).
      const res = ((await r.json()).results || []).sort((a, b) => (b.country_code === 'ES') - (a.country_code === 'ES'));
      if (!est.ciudad || ciudadTexto.value.trim() !== q) return; // ya se ha escrito otra cosa
      est.ciudad.items = res.map(x => ({
        nombre: x.name, lat: x.latitude, lon: x.longitude,
        zona: [x.admin1, x.country].filter(Boolean).join(', '),
      }));
      estado.textContent = res.length ? `${res.length} ${res.length === 1 ? 'resultado' : 'resultados'}` : `No encuentro «${q}»`;
    } catch (e) {
      estado.textContent = 'Sin conexión para buscar. Elige de la lista.';
      est.ciudad.items = sugeridas();
    }
    pintaCiudades();
    enfocaCiudad(est.ciudad.idx);
  }
  function eligeCiudad(c) {
    lugar = { nombre: c.nombre, lat: c.lat, lon: c.lon };
    guarda.poner('home-ciudad', lugar);
    tiempo = null;
    cierraCiudad();
    if (est.zona === 'hoja') cierraHoja();
    pintaTiempo();
    $('ahora-cielo').textContent = 'Cargando el tiempo…';
    cargaTiempo();
    aviso(`El tiempo ahora es de ${c.nombre}`);
  }

  ciudadTexto.addEventListener('input', () => { clearTimeout(buscaT); buscaT = setTimeout(buscaCiudad, 450); });
  ciudadTexto.addEventListener('focus', () => { if (est.ciudad) enfocaCiudad(-1); });
  ciudadLista.addEventListener('mousemove', e => {
    const li = e.target.closest('li[data-i]');
    if (li && est.ciudad && +li.dataset.i !== est.ciudad.idx) enfocaCiudad(+li.dataset.i);
  });
  ciudadLista.addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    if (li && est.ciudad) eligeCiudad(est.ciudad.items[+li.dataset.i]);
  });
  ciudadEl.addEventListener('click', e => { if (e.target === ciudadEl) cierraCiudad(); });

  /* ---------- Menús: de una app (OK, botón ☰ o clic derecho) y de un canal de la guía ---------- */
  const menuEl = $('menu'), menuLista = $('menu-lista');

  // La app que tiene el foco ahora mismo, si lo que tiene el foco es una app.
  function appEnfocada() {
    let it = null;
    if (est.zona === 'apps') it = est.dock[est.idx];
    else if (est.zona === 'otras') it = est.otras[est.oidx];
    else if (est.zona === 'hoja' && est.hoja === 'todas') it = est.hojaItems[est.hojaIdx];
    return it && it.pkg && !it.tipo ? it : null;
  }

  // ops: [{ txt, icono, sub?, hacer() }]. La primera viene marcada.
  function abreMenu(cabHtml, ops) {
    est.menu = { ops, idx: 0 };
    $('menu-cab').innerHTML = cabHtml;
    menuLista.innerHTML = ops.map((o, i) =>
      `<li data-i="${i}">${uso(o.icono)}<span>${esc(o.txt)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</li>`).join('');
    menuEl.hidden = false;
    enfocaMenu(0);
  }
  function enfocaMenu(i) {
    est.menu.idx = Math.max(0, Math.min(est.menu.ops.length - 1, i));
    [...menuLista.children].forEach((li, n) => li.classList.toggle('foco', n === est.menu.idx));
  }
  function cierraMenu() {
    est.menu = null;
    menuEl.hidden = true;
  }
  function ejecutaMenu(i) {
    const op = est.menu && est.menu.ops[i];
    cierraMenu();
    if (op) op.hacer();
  }

  function guardaFavoritas() { Puente.guardaFavoritas(favoritas); }
  function guardaOcultas() { Puente.guardaOcultas([...ocultas]); }

  // Repinta las filas (y la hoja si está abierta) y deja el foco en esa app si sigue en la misma zona.
  function repinta(pkg) {
    pintaDock();
    if (est.zona === 'hoja' && est.hoja === 'todas') {
      abreHoja('todas', Math.max(0, est.hojaItems.findIndex(a => a.pkg === pkg)));
    }
    let i = est.dock.findIndex(a => a.pkg === pkg);
    if (est.zona === 'apps' && i >= 0) { enfocaApp(i); return; }
    i = est.otras.findIndex(a => a.pkg === pkg);
    if (est.zona === 'otras' && i >= 0) { enfocaOtra(i); return; }
    if (est.zona === 'apps') enfocaApp(Math.min(est.idx, est.dock.length - 1));
    else if (est.zona === 'otras') enfocaOtra(Math.min(est.oidx, est.otras.length - 1));
    else marca();
  }

  function abreMenuApp() {
    const app = appEnfocada();
    if (!app) return;
    const oculta = ocultas.has(app.pkg), enInicio = favoritas.includes(app.pkg) && !oculta;
    const el = focoEl();
    const ops = [{ txt: 'Abrir', icono: 'play', hacer: () => lanzaApp(app.pkg, el) }];
    if (enInicio) {
      ops.push({ txt: 'Mover', icono: 'mover', hacer: () => empiezaMover(app) });
      ops.push({ txt: 'Quitar de la pantalla de inicio', icono: 'menos', hacer: () => {
        favoritas = favoritas.filter(p => p !== app.pkg); guardaFavoritas(); repinta(app.pkg);
        aviso(`${app.nombre} ya no está en la pantalla de inicio`);
      } });
    } else if (!oculta) {
      ops.push({ txt: 'Añadir a la pantalla de inicio', icono: 'mas', hacer: () => {
        favoritas.push(app.pkg); guardaFavoritas(); repinta(app.pkg);
        aviso(`${app.nombre} está en la pantalla de inicio`);
      } });
    }
    if (est.zona === 'hoja') {
      ops.push(oculta
        ? { txt: 'Volver a mostrar', icono: 'ver', hacer: () => { ocultas.delete(app.pkg); guardaOcultas(); repinta(app.pkg); aviso(`${app.nombre} vuelve a verse`); } }
        : { txt: 'Ocultar', icono: 'ocultar', hacer: () => { ocultas.add(app.pkg); guardaOcultas(); repinta(app.pkg); aviso(`${app.nombre} oculta. Está al final de «Todas las apps»`); } });
    }
    ops.push({ txt: 'Información de la app', icono: 'info', hacer: () => Puente.sistema('info:' + app.pkg) });
    abreMenu(`${tileHtml(app)}<p class="menu-nombre">${esc(app.nombre)}</p>`, ops);
  }

  // Canal de la guía: verlo en su app, o pedir aviso de lo que viene después.
  function abreMenuCanal(c) {
    const app = apps.find(a => a.pkg === c.pkg) || { nombre: 'la app' };
    const ahoraS = Date.now() / 1000, el = focoEl();
    const ya = c.progs.find(p => p.ini <= ahoraS && p.fin > ahoraS);
    const ops = [{ txt: ENLACES[c.canal] ? `Ver ${nombreCanal(c.canal)} en directo` : `Ver en ${app.nombre}`,
      icono: 'play', sub: ya ? ya.titulo : '', hacer: () => lanzaApp(c.pkg, el, ENLACES[c.canal]) }];
    c.progs.filter(p => p.ini > ahoraS).slice(0, 4).forEach(p => {
      const puesto = tieneAviso(c.canal, p.ini);
      ops.push({
        txt: `${hhmm(new Date(p.ini * 1000))}  ${p.titulo}`,
        icono: puesto ? 'campana-on' : 'campana',
        sub: puesto ? 'Quitar aviso' : 'Avisarme',
        hacer: () => alternaAviso(c, p),
      });
    });
    const cab = c.logo ? `<div class="menu-logo"><img src="${esc(c.logo)}" alt=""></div>` : '';
    abreMenu(`${cab}<p class="menu-nombre">${esc(nombreCanal(c.canal))}</p>`, ops);
  }

  /* ---------- Temporizador de apagado ---------- */
  function abreMenuTemporizador() {
    const fin = Puente.temporizadorFin();
    const pon = min => () => {
      Puente.temporizador(min);
      pintaTemporizador();
      aviso(min ? `La caja se apagará a las ${hhmm(new Date(Date.now() + min * 60000))}` : 'Temporizador cancelado');
    };
    const PLAZOS = [[30, '30 minutos'], [60, '1 hora'], [90, '1 hora y media'], [120, '2 horas']];
    const ops = PLAZOS.map(([m, txt]) => ({ txt: `Dentro de ${txt}`, icono: 'reloj', hacer: pon(m) }));
    if (fin) ops.unshift({ txt: 'Cancelar temporizador', icono: 'menos', sub: `se apaga a las ${hhmm(new Date(fin))}`, hacer: pon(0) });
    abreMenu(`<div class="menu-logo">${uso('reloj')}</div><p class="menu-nombre">Temporizador</p>`, ops);
  }
  // Píldora junto a la hora mientras hay temporizador.
  function pintaTemporizador() {
    const fin = Puente.temporizadorFin(), el = $('temporiza');
    el.hidden = !fin;
    if (fin) $('temporiza-txt').textContent = duracion(Math.max(60, (fin - Date.now()) / 1000));
  }

  /* ---------- Avisos automáticos por palabras ---------- */
  const palEl = $('palabras'), palTexto = $('pal-texto'), palLista = $('pal-lista'), palCaja = $('pal-caja');
  // Todos los canales de las apps de TV instaladas, con su app: ahí es donde se buscan las palabras.
  function canalesTele() {
    const m = {};
    for (const [pkg, lista] of Object.entries(CANALES)) if (instalada(pkg)) lista.forEach(c => { m[c] = pkg; });
    return m;
  }
  function abrePalabras() {
    est.pal = { items: Puente.palabras().palabras, idx: -1 };
    palTexto.value = '';
    pintaPalabras();
    palEl.hidden = false;
    enfocaPal(-1);
  }
  function cierraPalabras() {
    est.pal = null;
    palTexto.blur();
    palEl.hidden = true;
  }
  function pintaPalabras() {
    const n = avisos.filter(a => a.auto).length;
    $('pal-estado').textContent = est.pal.items.length
      ? `${n ? `${n} ${n === 1 ? 'programa avisado' : 'programas avisados'} de momento. ` : ''}OK sobre una palabra para quitarla`
      : 'Escribe un equipo, una serie o un programa';
    palLista.innerHTML = est.pal.items.map((p, i) => `<li data-i="${i}">${uso('campana')}<span>${esc(p)}</span><small>Quitar</small></li>`).join('');
  }
  function enfocaPal(i) {
    const p = est.pal;
    p.idx = Math.max(-1, Math.min(p.items.length - 1, i));
    palCaja.classList.toggle('foco', p.idx === -1);
    [...palLista.children].forEach((li, n) => li.classList.toggle('foco', n === p.idx));
    if (p.idx !== -1 && document.activeElement === palTexto) palTexto.blur();
  }
  function guardaPalabras(lista) {
    est.pal.items = lista;
    Puente.guardaPalabras({ palabras: lista, canales: canalesTele() });
    buscaPalabras();
    pintaPalabras();
  }
  function anadePalabra(q) {
    q = (q || '').trim();
    if (q.length < 3) { aviso('Escribe al menos 3 letras'); return; }
    if (est.pal.items.some(p => p.toLowerCase() === q.toLowerCase())) return;
    guardaPalabras(est.pal.items.concat([q]));
    palTexto.value = '';
    aviso(`Te avisaré cuando echen «${q}»`);
  }
  function quitaPalabra(i) {
    const q = est.pal.items[i];
    guardaPalabras(est.pal.items.filter((_, n) => n !== i));
    enfocaPal(Math.min(i, est.pal.items.length - 1));
    aviso(`Ya no te avisaré de «${q}»`);
  }
  // En el PC la página busca ella misma en la guía; en la caja lo hace Java con cada guía nueva.
  const sinTilde = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  async function buscaPalabras() {
    if (Puente.nativo) { setTimeout(() => { avisos = Puente.avisos(); if (est.pal) pintaPalabras(); }, 1500); return; }
    const cfg = Puente.palabras();
    if (!cfg.palabras.length) return;
    const mapa = canalesTele();
    const g = await Puente.guia(Object.keys(mapa)).catch(() => null);
    if (!g || !g.canales) return;
    const ahoraS = Date.now() / 1000, ya = new Set(Puente.avisos().map(a => a.id));
    for (const [canal, progs] of Object.entries(g.canales)) {
      for (const p of progs) {
        if (p.ini <= ahoraS + 60) continue;
        const palabra = cfg.palabras.find(w => sinTilde(p.titulo).includes(sinTilde(w)));
        const id = idAviso(canal, p.ini);
        if (palabra && !ya.has(id)) {
          ya.add(id);
          Puente.ponAviso({ id, canal, nombre: nombreCanal(canal), titulo: p.titulo, ini: p.ini, pkg: mapa[canal], auto: palabra });
        }
      }
    }
    avisos = Puente.avisos();
    if (est.pal) pintaPalabras();
  }
  palLista.addEventListener('mousemove', e => {
    const li = e.target.closest('li[data-i]');
    if (li && est.pal && +li.dataset.i !== est.pal.idx) enfocaPal(+li.dataset.i);
  });
  palLista.addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    if (li && est.pal) quitaPalabra(+li.dataset.i);
  });
  palTexto.addEventListener('focus', () => { if (est.pal) enfocaPal(-1); });
  palEl.addEventListener('click', e => { if (e.target === palEl) cierraPalabras(); });

  /* ---------- Usar el móvil: QR de emparejamiento con el mando que sirve la propia caja ---------- */
  const qrEl = $('qr');
  let qrT = 0;
  function abreQR() {
    est.qr = true;
    qrEl.hidden = false;
    $('qr-codigo').innerHTML = '';
    clearInterval(qrT);
    const d = Puente.codigoMovil();
    if (!d || !d.url) {
      $('qr-estado').textContent = 'No se ha podido preparar el código. Vuelve a intentarlo.';
      return;
    }
    const q = qrcode(0, 'M');
    q.addData(d.url);
    q.make();
    const n = q.getModuleCount();
    let ruta = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) ruta += `M${x} ${y}h1v1h-1z`;
    // stroke="none": la regla general de iconos pone un trazo blanco que taparía los módulos negros.
    $('qr-codigo').innerHTML = `<svg viewBox="-4 -4 ${n + 8} ${n + 8}" shape-rendering="crispEdges" stroke="none" style="stroke:none"><rect x="-4" y="-4" width="${n + 8}" height="${n + 8}" fill="#fff"/><path d="${ruta}" fill="#000"/></svg>`;
    const cuenta = () => {
      const quedan = d.caduca - Date.now() / 1000;
      if (quedan <= 0) { abreQR(); return; } // caducado: uno nuevo
      $('qr-estado').textContent = `Vale una sola vez. Caduca en ${Math.floor(quedan / 60)}:${dos(Math.floor(quedan % 60))}`;
      // La primera vez la caja pide permiso para depurarse a sí misma: avisa de qué aceptar.
      const adb = Puente.estadoAdb();
      $('qr-nota').textContent = adb === 'esperando permiso'
        ? 'Si la tele pregunta «¿Permitir la depuración?», marca «Permitir siempre» y acepta. Solo una vez.'
        : 'Funciona con el PC apagado. Los móviles emparejados se quitan en Ajustes → Móviles emparejados.';
    };
    cuenta();
    qrT = setInterval(cuenta, 1000);
  }
  // Móviles emparejados: OK sobre uno lo quita (deja de poder usar el mando hasta escanear otra vez).
  function abreMenuMoviles() {
    const lista = Puente.moviles();
    const ops = lista.map(m => ({
      txt: m.nombre, icono: 'movil', sub: 'Quitar',
      hacer: () => { Puente.quitaMovil(m.id); aviso(`${m.nombre} ya no es un mando`); },
    }));
    if (!ops.length) ops.push({ txt: 'Ninguno todavía', icono: 'movil', sub: 'Usar el móvil', hacer: abreQR });
    abreMenu(`<div class="menu-logo">${uso('movil')}</div><p class="menu-nombre">Móviles emparejados</p>`, ops);
  }
  function cierraQR() {
    est.qr = false;
    clearInterval(qrT);
    qrEl.hidden = true;
  }
  qrEl.addEventListener('click', e => { if (e.target === qrEl) cierraQR(); });

  /* ---------- Instalar app: los .apk de la caja (pendrive, Descargas) ---------- */
  const instEl = $('instalar'), instLista = $('inst-lista'), instAbrir = $('inst-abrir');
  let instT = 0;
  const megas = b => b >= 1048576 ? `${Math.round(b / 1048576)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

  function abreInstalar() {
    est.inst = { items: [], idx: 0, hecha: null };
    instEl.hidden = false;
    instLista.innerHTML = '';
    $('inst-vacia').hidden = true;
    $('inst-sub').textContent = 'Buscando en la caja y en el pendrive…';
    // Buscar bloquea un momento: primero se pinta la ventana.
    setTimeout(() => {
      if (!est.inst) return;
      est.inst.items = Puente.apks();
      pintaApks();
      sigueInstalacion();
    }, 60);
  }
  function pintaApks() {
    const items = est.inst.items;
    $('inst-sub').textContent = items.length ? 'OK para instalar · si ya la tienes, se actualiza' : '';
    $('inst-vacia').hidden = items.length > 0;
    instLista.innerHTML = items.map((a, i) => {
      const meta = [a.version, megas(a.tam), a.origen].filter(Boolean).join(' · ');
      const marca = a.roto ? ['rota', 'Archivo dañado']
        : a.comparada === 'nueva' ? ['nueva', `Actualiza la ${a.instalada}`]
        : a.comparada === 'igual' ? ['', 'Ya la tienes']
        : a.comparada === 'vieja' ? ['vieja', `Tienes una más nueva`] : null;
      const ic = a.icono ? `<img src="${esc(a.icono)}" alt="">` : uso('paquete');
      return `<li data-i="${i}" class="${a.roto ? 'rota' : ''}"><span class="inst-ic">${ic}</span>` +
        `<span class="inst-txt"><b>${esc(a.nombre || a.archivo)}</b><small>${esc(meta)}</small></span>` +
        (marca ? `<span class="inst-marca ${marca[0]}">${marca[1]}</span>` : '') + '</li>';
    }).join('');
    enfocaInst(Math.min(est.inst.idx, Math.max(0, items.length - 1)));
  }
  // 0..n-1 los archivos; n es «Abrir» cuando acaba de instalarse una.
  function enfocaInst(i) {
    const s = est.inst, max = s.items.length - (s.hecha ? 0 : 1);
    s.idx = Math.max(0, Math.min(max, i));
    [...instLista.children].forEach((li, n) => li.classList.toggle('foco', n === s.idx));
    instAbrir.classList.toggle('foco', !!s.hecha && s.idx === s.items.length);
    const li = instLista.children[s.idx];
    if (li) li.scrollIntoView({ block: 'nearest' });
  }
  function okInst() {
    const s = est.inst;
    if (s.hecha && s.idx === s.items.length) { const pkg = s.hecha; cierraInstalar(); lanzaApp(pkg); return; }
    const a = s.items[s.idx];
    if (!a) return;
    if (a.roto) { aviso('Ese archivo está dañado: no se puede instalar'); return; }
    if (!Puente.instalaApk(a.ruta)) { aviso('Ya hay otra instalación en marcha'); return; }
    s.hecha = null;
    sigueInstalacion();
  }
  // Pinta cómo va la instalación (también las del móvil) mientras la ventana esté abierta.
  function sigueInstalacion() {
    clearTimeout(instT);
    if (!est.inst) return;
    const e = Puente.instalacion(), caja = $('inst-estado');
    const reciente = e.fase && (e.fase === 'recibiendo' || e.fase === 'instalando' || Date.now() - (e.t || Date.now()) < 60000);
    caja.hidden = !reciente;
    instAbrir.hidden = true;
    if (!reciente) return;
    caja.className = `inst-estado ${e.fase}`;
    const barra = $('inst-barra');
    barra.classList.toggle('sin-pct', e.fase === 'instalando');
    barra.style.setProperty('--pct', (e.pct || 0) / 100);
    const movil = e.origen === 'movil' ? ' desde el móvil' : '';
    $('inst-texto').textContent =
      e.fase === 'recibiendo' ? `Recibiendo ${e.nombre}${movil} · ${e.pct || 0} %`
      : e.fase === 'instalando' ? `Instalando ${e.nombre}${movil}…`
      : e.fase === 'hecha' ? `✓ ${e.nombre} instalada`
      : `No se ha instalado ${e.nombre}. ${e.error || ''}`;
    if (e.fase === 'hecha' && e.pkg && est.inst.vista !== e.t) {
      // Recién instalada: la lista y las apps cambian, y «Abrir» queda marcado si la app tiene pantalla.
      est.inst.vista = e.t;
      est.inst.hecha = e.abrible ? e.pkg : null;
      apps = Puente.apps();
      pintaDock();
      est.inst.items = Puente.apks();
      pintaApks();
      instAbrir.hidden = !est.inst.hecha;
      if (est.inst.hecha) enfocaInst(est.inst.items.length);
      return;
    }
    instAbrir.hidden = !(e.fase === 'hecha' && est.inst.hecha);
    if (e.fase === 'recibiendo' || e.fase === 'instalando') instT = setTimeout(sigueInstalacion, 700);
  }
  function cierraInstalar() {
    est.inst = null;
    clearTimeout(instT);
    instEl.hidden = true;
  }
  instLista.addEventListener('mousemove', e => {
    const li = e.target.closest('li[data-i]');
    if (li && est.inst && +li.dataset.i !== est.inst.idx) enfocaInst(+li.dataset.i);
  });
  instLista.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li && est.inst) { enfocaInst(+li.dataset.i); okInst(); } });
  instAbrir.addEventListener('click', () => { if (est.inst) { enfocaInst(est.inst.items.length); okInst(); } });
  instEl.addEventListener('click', e => { if (e.target === instEl) cierraInstalar(); });

  /* ---------- Avisos de programas ---------- */
  function alternaAviso(c, p) {
    const id = idAviso(c.canal, p.ini);
    if (tieneAviso(c.canal, p.ini)) {
      Puente.quitaAviso(id);
      aviso('Aviso quitado');
    } else {
      Puente.ponAviso({ id, canal: c.canal, nombre: nombreCanal(c.canal), titulo: p.titulo, ini: p.ini, pkg: c.pkg });
      aviso(`Te avisaré a las ${hhmm(new Date((p.ini - 60) * 1000))}: ${p.titulo}`);
    }
    avisos = Puente.avisos();
    pintaContenido(est.dock[est.idx]);
  }
  // En el PC no hay alarma de la caja: la página avisa ella misma un minuto antes.
  function compruebaAvisos() {
    if (Puente.nativo) return;
    const ahoraS = Date.now() / 1000;
    avisos.filter(a => a.ini - 60 <= ahoraS).forEach(a => {
      aviso(`Empieza en ${a.nombre}: ${a.titulo}`);
      Puente.quitaAviso(a.id);
    });
    avisos = Puente.avisos();
  }

  /* ---------- Abrir una app: la tarjeta crece hasta llenar la pantalla ---------- */
  const lanzaEl = $('lanza');
  function focoEl() {
    if (est.zona === 'apps') return dockEl.children[est.idx];
    if (est.zona === 'otras') return otrasEl.children[est.oidx];
    if (est.zona === 'cont') return contEl.children[est.cidx];
    if (est.zona === 'hoja') return rejilla.children[est.hojaIdx];
    return null;
  }
  function lanzaApp(pkg, el, url) {
    const app = apps.find(a => a.pkg === pkg) || { color: '#2B3340', nombre: '' };
    if (!mueve) { Puente.abrir(pkg, url); return; }
    const caja = el && (el.querySelector('.tile, .tarjeta') || el);
    const s = stage.getBoundingClientRect(), k = s.width / 1920;
    let x = 760, y = 440, w = 400, h = 225;
    if (caja) {
      const r = caja.getBoundingClientRect();
      x = (r.left - s.left) / k; y = (r.top - s.top) / k; w = r.width / k; h = r.height / k;
    }
    lanzaEl.style.setProperty('--c', app.color || '#2B3340');
    // El nombre aparece cuando la capa ya ocupa la pantalla: si la app tarda, se sabe qué se está abriendo.
    lanzaEl.innerHTML = (app.banner ? `<img src="${esc(app.banner)}" alt="">` : '') +
      (app.nombre ? `<p class="lanza-txt">Abriendo ${esc(app.nombre)}…</p>` : '');
    lanzaEl.classList.remove('va', 'sale');
    lanzaEl.style.transform = `translate(${x}px, ${y}px) scale(${w / 1920}, ${h / 1080})`;
    lanzaEl.hidden = false;
    void lanzaEl.offsetWidth;
    lanzaEl.classList.add('va');
    lanzaEl.style.transform = 'translate(0, 0) scale(1, 1)';
    setTimeout(() => Puente.abrir(pkg, url), 380);
    // Si la app no llega a abrirse (o en el PC), la capa se retira sola.
    setTimeout(cierraLanza, Puente.nativo ? 5000 : 1300);
  }
  function cierraLanza() {
    if (lanzaEl.hidden) return;
    lanzaEl.classList.add('sale');
    setTimeout(() => { lanzaEl.hidden = true; lanzaEl.classList.remove('va', 'sale'); }, 350);
  }

  /* ---------- Buscar en YouTube ---------- */
  const buscaEl = $('busca'), buscaTexto = $('busca-texto'), buscaLista = $('busca-lista'), buscaCaja = $('busca-caja');
  function abreBusca() {
    est.busca = { items: guarda.leer('home-busquedas') || [], idx: -1 };
    buscaTexto.value = '';
    buscaLista.innerHTML = est.busca.items.map((q, i) => `<li data-i="${i}">${uso('reloj')}<span>${esc(q)}</span></li>`).join('');
    $('busca-estado').textContent = est.busca.items.length ? 'Búsquedas recientes' : 'Escribe o usa el micrófono del teclado';
    buscaEl.hidden = false;
    enfocaBusca(-1);
  }
  function cierraBusca() {
    est.busca = null;
    buscaTexto.blur();
    buscaEl.hidden = true;
  }
  function enfocaBusca(i) {
    const b = est.busca;
    b.idx = Math.max(-1, Math.min(b.items.length - 1, i));
    buscaCaja.classList.toggle('foco', b.idx === -1);
    [...buscaLista.children].forEach((li, n) => li.classList.toggle('foco', n === b.idx));
    if (b.idx !== -1 && document.activeElement === buscaTexto) buscaTexto.blur();
  }
  function busca(q) {
    q = (q || '').trim();
    if (!q) return;
    guarda.poner('home-busquedas', [q].concat((guarda.leer('home-busquedas') || []).filter(x => x !== q)).slice(0, 6));
    cierraBusca();
    Puente.buscaYouTube(q);
  }
  buscaLista.addEventListener('mousemove', e => {
    const li = e.target.closest('li[data-i]');
    if (li && est.busca && +li.dataset.i !== est.busca.idx) enfocaBusca(+li.dataset.i);
  });
  buscaLista.addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    if (li && est.busca) busca(est.busca.items[+li.dataset.i]);
  });
  buscaTexto.addEventListener('focus', () => { if (est.busca) enfocaBusca(-1); });
  buscaEl.addEventListener('click', e => { if (e.target === buscaEl) cierraBusca(); });

  /* Mover: la app se queda «cogida» y ◀ ▶ la cambian de sitio dentro de su fila. OK o Atrás la sueltan. */
  function empiezaMover(app) {
    if (est.zona === 'hoja') cierraHoja();
    let i = est.dock.indexOf(app);
    if (i >= 0) enfocaApp(i);
    else enfocaOtra(est.otras.indexOf(app));
    est.mover = app;
    document.querySelector('.stage').classList.add('moviendo');
    aviso('Muévela con ◀ ▶ y pulsa OK para dejarla', true);
  }
  function mueveApp(dir) {
    const fila = est.zona === 'apps' ? est.dock : est.otras;
    const i = fila.indexOf(est.mover), j = i + dir;
    const vecina = fila[j];
    if (!vecina || vecina.tipo) return; // los bordes y las tarjetas Todas/Ajustes no se mueven
    const a = favoritas.indexOf(est.mover.pkg), b = favoritas.indexOf(vecina.pkg);
    [favoritas[a], favoritas[b]] = [favoritas[b], favoritas[a]];
    repinta(est.mover.pkg);
  }
  function sueltaMover() {
    est.mover = null;
    document.querySelector('.stage').classList.remove('moviendo');
    guardaFavoritas();
    aviso('Listo');
  }

  /* Aviso breve al pie */
  let avisoT = 0;
  function aviso(txt, fijo) {
    const el = $('aviso');
    el.textContent = txt;
    el.classList.add('ver');
    clearTimeout(avisoT);
    if (!fijo) avisoT = setTimeout(() => el.classList.remove('ver'), 2600);
  }

  /* ---------- Mando y teclado ---------- */
  addEventListener('keydown', e => {
    const atras = e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack';
    if (e.key === 'Enter' && e.repeat) { e.preventDefault(); return; }

    if (est.qr) {
      if (atras || e.key === 'Enter') cierraQR();
      e.preventDefault();
      return;
    }
    if (est.inst) {
      if (e.key === 'ArrowUp') enfocaInst(est.inst.idx - 1);
      else if (e.key === 'ArrowDown') enfocaInst(est.inst.idx + 1);
      else if (e.key === 'Enter') okInst();
      else if (atras) cierraInstalar();
      e.preventDefault();
      return;
    }
    if (est.pal) {
      if (document.activeElement === palTexto) {
        // Escribiendo: OK añade la palabra; ↓ baja a la lista.
        if (e.key === 'Enter') { e.preventDefault(); anadePalabra(palTexto.value); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); palTexto.blur(); enfocaPal(0); }
        else if (e.key === 'Escape' || e.key === 'GoBack') { e.preventDefault(); palTexto.blur(); }
        return;
      }
      const i = est.pal.idx;
      if (e.key === 'ArrowUp') enfocaPal(i - 1);
      else if (e.key === 'ArrowDown') enfocaPal(i + 1);
      else if (e.key === 'Enter') { if (i === -1) palTexto.focus(); else quitaPalabra(i); }
      else if (atras) cierraPalabras();
      e.preventDefault();
      return;
    }
    if (est.busca) {
      if (document.activeElement === buscaTexto) {
        // Escribiendo: OK busca; ↓ baja a las búsquedas recientes.
        if (e.key === 'Enter') { e.preventDefault(); busca(buscaTexto.value); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); buscaTexto.blur(); enfocaBusca(0); }
        else if (e.key === 'Escape' || e.key === 'GoBack') { e.preventDefault(); buscaTexto.blur(); }
        return;
      }
      const i = est.busca.idx;
      if (e.key === 'ArrowUp') enfocaBusca(i - 1);
      else if (e.key === 'ArrowDown') enfocaBusca(i + 1);
      else if (e.key === 'Enter') { if (i === -1) buscaTexto.focus(); else busca(est.busca.items[i]); }
      else if (atras) cierraBusca();
      e.preventDefault();
      return;
    }
    if (est.ciudad) {
      if (document.activeElement === ciudadTexto) {
        // Escribiendo: las teclas son para el texto; OK o ↓ buscan y bajan a los resultados.
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          clearTimeout(buscaT);
          ciudadTexto.blur();
          buscaCiudad().then(() => enfocaCiudad(0));
        } else if (e.key === 'Escape' || e.key === 'GoBack') {
          e.preventDefault();
          ciudadTexto.blur();
        }
        return;
      }
      const i = est.ciudad.idx;
      if (e.key === 'ArrowUp') enfocaCiudad(i - 1);
      else if (e.key === 'ArrowDown') enfocaCiudad(i + 1);
      else if (e.key === 'Enter') { if (i === -1) ciudadTexto.focus(); else eligeCiudad(est.ciudad.items[i]); }
      else if (atras) cierraCiudad();
      e.preventDefault();
      return;
    }

    if (est.menu) {
      if (e.key === 'ArrowUp') enfocaMenu(est.menu.idx - 1);
      else if (e.key === 'ArrowDown') enfocaMenu(est.menu.idx + 1);
      else if (e.key === 'Enter') ejecutaMenu(est.menu.idx);
      else if (atras || e.key === 'ContextMenu') cierraMenu();
      e.preventDefault();
      return;
    }
    if (est.mover) {
      if (e.key === 'ArrowLeft') mueveApp(-1);
      else if (e.key === 'ArrowRight') mueveApp(1);
      else if (e.key === 'Enter' || atras) sueltaMover();
      e.preventDefault();
      return;
    }
    if (e.key === 'ContextMenu') {
      const c = est.zona === 'cont' && est.cont[est.cidx];
      if (c && c.tipo === 'canal') abreMenuCanal(c); else abreMenuApp();
      e.preventDefault();
      return;
    }
    // Un OK sobre una app abre su menú; «Abrir» ya viene marcado, así que abrirla es OK, OK.
    if (e.key === 'Enter' && appEnfocada()) { abreMenuApp(); e.preventDefault(); return; }

    if (est.zona === 'hoja') {
      const i = est.hojaIdx;
      if (e.key === 'ArrowLeft') enfocaHoja(i - 1);
      else if (e.key === 'ArrowRight') enfocaHoja(i + 1);
      else if (e.key === 'ArrowUp') enfocaHoja(i - COLS >= 0 ? i - COLS : i);
      else if (e.key === 'ArrowDown') enfocaHoja(i + COLS < est.hojaItems.length ? i + COLS : i);
      else if (e.key === 'Enter') activa(est.hojaItems[i]);
      else if (atras) cierraHoja();
      else return;
    } else if (est.zona === 'otras') {
      if (e.key === 'ArrowLeft') enfocaOtra(est.oidx - 1);
      else if (e.key === 'ArrowRight') enfocaOtra(est.oidx + 1);
      else if (e.key === 'ArrowUp') { if (est.cont.length) enfocaCont(est.cidx); else enfocaApp(est.idx); }
      else if (e.key === 'Enter') activa(est.otras[est.oidx]);
      else if (atras) enfocaApp(est.idx);
      else return;
    } else if (est.zona === 'cont') {
      if (e.key === 'ArrowLeft') enfocaCont(est.cidx - 1);
      else if (e.key === 'ArrowRight') enfocaCont(est.cidx + 1);
      else if (e.key === 'ArrowUp' || atras) enfocaApp(est.idx);
      else if (e.key === 'ArrowDown') enfocaOtra(est.oidx);
      else if (e.key === 'Enter') activa(est.cont[est.cidx], contEl.children[est.cidx]);
      else return;
    } else {
      if (e.key === 'ArrowLeft') enfocaApp(est.idx - 1);
      else if (e.key === 'ArrowRight') enfocaApp(est.idx + 1);
      else if (e.key === 'ArrowDown') { if (est.cont.length) enfocaCont(est.cidx); else enfocaOtra(est.oidx); }
      else if (e.key === 'Enter') activa(est.dock[est.idx]);
      else if (atras) enfocaApp(0); // Atrás en el inicio vuelve a la primera app, nunca sale.
      else return;
    }
    e.preventDefault();
  });

  /* ---------- Ratón (PC) ---------- */
  // mousemove y no mouseover: al desplazarse una fila bajo un ratón quieto no debe robar el foco al mando.
  dockEl.addEventListener('mousemove', e => {
    const li = e.target.closest('li[data-i]');
    if (li && (est.zona !== 'apps' || +li.dataset.i !== est.idx)) enfocaApp(+li.dataset.i);
  });
  dockEl.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) activa(est.dock[+li.dataset.i]); });
  contEl.addEventListener('mousemove', e => {
    const li = e.target.closest('li[data-i]');
    if (li && (est.zona !== 'cont' || +li.dataset.i !== est.cidx)) enfocaCont(+li.dataset.i);
  });
  contEl.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) activa(est.cont[+li.dataset.i], li); });
  otrasEl.addEventListener('mousemove', e => {
    const li = e.target.closest('li[data-i]');
    if (li && (est.zona !== 'otras' || +li.dataset.i !== est.oidx)) enfocaOtra(+li.dataset.i);
  });
  otrasEl.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) activa(est.otras[+li.dataset.i]); });
  rejilla.addEventListener('mousemove', e => {
    const li = e.target.closest('li[data-i]');
    if (li && +li.dataset.i !== est.hojaIdx) enfocaHoja(+li.dataset.i);
  });
  rejilla.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) activa(est.hojaItems[+li.dataset.i]); });
  hojaEl.addEventListener('click', e => { if (e.target === hojaEl) cierraHoja(); });

  // Clic derecho: el menú de la app (primero se enfoca lo que hay bajo el ratón).
  stage.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (est.menu || est.mover) return;
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    if (li.parentElement === dockEl) enfocaApp(+li.dataset.i);
    else if (li.parentElement === otrasEl) enfocaOtra(+li.dataset.i);
    else if (li.parentElement === rejilla) enfocaHoja(+li.dataset.i);
    else return;
    abreMenuApp();
  });
  menuLista.addEventListener('mousemove', e => {
    const li = e.target.closest('li[data-i]');
    if (li && est.menu) enfocaMenu(+li.dataset.i);
  });
  menuLista.addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    if (li && est.menu) ejecutaMenu(+li.dataset.i);
  });
  menuEl.addEventListener('click', e => { if (e.target === menuEl) cierraMenu(); });

  /* ---------- Arranque ---------- */
  function inicio() {
    $('muestra').hidden = Puente.nativo;
    // En la caja: sin desenfoque real ni animaciones de fondo (ver .en-caja en tema-liquido.css).
    document.documentElement.classList.toggle('en-caja', Puente.nativo);
    apps = Puente.apps();
    favoritas = Puente.favoritas();
    ocultas = new Set(Puente.ocultas());
    avisos = Puente.avisos();
    pintaHora();
    // Avisos automáticos: al arrancar se actualiza qué canales hay (por si se instaló otra app de TV) y se busca.
    const pal = Puente.palabras();
    if (pal.palabras.length) { Puente.guardaPalabras({ palabras: pal.palabras, canales: canalesTele() }); buscaPalabras(); }
    pintaCaja();
    pintaLuna();
    if (tiempo) pintaTiempo();
    pintaDock();
    // Arranca en la última app usada: seguir viendo queda a un OK de distancia.
    let ultima = 0;
    est.dock.forEach((it, i) => { if ((it.ultimo || 0) > (est.dock[ultima].ultimo || 0)) ultima = i; });
    est.idx = -1;
    enfocaApp(ultima);
    cargaTiempo();

    setInterval(pintaHora, 5000);
    setInterval(() => {
      pintaCaja(); pintaSol(); pintaLuna();
      // La barra de «en directo» avanza: repinta la segunda fila si es una guía.
      const it = est.dock[est.idx];
      if (it && canalesDe(it).length && !est.menu) pintaContenido(it);
    }, 60 * 1000);
    setInterval(cargaTiempo, 30 * 60 * 1000);
    setInterval(compruebaAvisos, 20 * 1000);
  }

  // La caja llama a esto al volver a la pantalla de inicio desde una app: refresca usos, historial y estado.
  window.homeVuelve = function () {
    if (!est.dock.length) return; // aún arrancando
    cierraLanza();
    avisos = Puente.avisos(); // los que ya sonaron los quitó la caja
    apps = Puente.apps();
    pintaDock();
    marca();
    pintaContenido(est.dock[est.idx]);
    pintaCaja();
  };

  document.fonts.ready.then(inicio);
})();
