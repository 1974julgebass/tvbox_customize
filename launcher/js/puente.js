/* Puente con la caja. En la app Android existe window.TVHome (interfaz Java); en el navegador del PC no,
   y se usan datos de muestra para poder diseñar y probar con las flechas del teclado. */
(function () {
  'use strict';

  const nativo = typeof window.TVHome === 'object' && window.TVHome !== null;

  function json(fn, porDefecto) {
    try { return JSON.parse(fn()); } catch (e) { return porDefecto; }
  }

  // Colores e insignias de línea de las apps conocidas; las demás salen de su nombre.
  const LINEAS = {
    'com.movistarplus.androidtv': { codigo: 'M+', color: '#1F3FE0' },
    'com.filmin.androidtv': { codigo: 'FI', color: '#0E8F6A' },
    'com.rtve.androidtv': { codigo: 'TVE', color: '#D0451B' },
    'com.google.android.youtube.tv': { codigo: 'YT', color: '#E0201B' },
    'org.videolan.vlc': { codigo: 'VLC', color: '#E8780E' },
    'org.courville.nova': { codigo: 'NV', color: '#1572C9' },
    'com.pecana.iptvextremepro': { codigo: 'TV', color: '#5B3FC4' },
    'com.antena3.atresplayer.tv': { codigo: 'A3', color: '#C81E5B' },
    'com.surfshark.vpnclient.android': { codigo: 'VPN', color: '#178A8F' },
    'com.lonelycatgames.Xplore': { codigo: 'XP', color: '#3C7A2E' },
    'com.analiti.fastest.android': { codigo: 'WF', color: '#6B6F76' },
  };
  const PALETA = ['#1F3FE0', '#0E8F6A', '#D0451B', '#5B3FC4', '#C81E5B', '#178A8F', '#3C7A2E', '#9A6A12'];

  function linea(app) {
    if (LINEAS[app.pkg]) return LINEAS[app.pkg];
    const palabras = app.nombre.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean);
    const codigo = (palabras.length > 1 ? palabras[0][0] + palabras[1][0] : app.nombre.slice(0, 2)).toUpperCase();
    let h = 0;
    for (const c of app.pkg) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return { codigo, color: app.color || PALETA[h % PALETA.length] };
  }

  /* ---- Datos de muestra (solo navegador): apps reales de la caja, usos inventados ---- */
  const MIN = 60 * 1000, HORA = 60 * MIN, DIA = 24 * HORA;
  const ahora = Date.now();
  const MUESTRA_APPS = [
    { pkg: 'com.movistarplus.androidtv', nombre: 'Movistar+', ultimo: ahora - 22 * MIN, usos: 19 },
    { pkg: 'com.google.android.youtube.tv', nombre: 'YouTube', ultimo: ahora - 3 * HORA, usos: 14 },
    { pkg: 'com.filmin.androidtv', nombre: 'Filmin', ultimo: ahora - DIA - 2 * HORA, usos: 6 },
    { pkg: 'com.rtve.androidtv', nombre: 'RTVE Play', ultimo: ahora - 2 * DIA, usos: 4 },
    { pkg: 'com.antena3.atresplayer.tv', nombre: 'Atresplayer', ultimo: ahora - 4 * DIA, usos: 2 },
    { pkg: 'org.videolan.vlc', nombre: 'VLC', ultimo: ahora - 6 * DIA, usos: 1 },
    { pkg: 'com.pecana.iptvextremepro', nombre: 'IPTV Extreme Pro', ultimo: ahora - 9 * DIA, usos: 0 },
    { pkg: 'org.courville.nova', nombre: 'Nova Video Player', ultimo: ahora - 20 * DIA, usos: 0 },
    { pkg: 'com.surfshark.vpnclient.android', nombre: 'Surfshark', ultimo: ahora - 30 * MIN, usos: 3 },
    { pkg: 'com.lonelycatgames.Xplore', nombre: 'X-plore', ultimo: 0, usos: 0 },
    { pkg: 'com.analiti.fastest.android', nombre: 'Speed WiFi', ultimo: 0, usos: 0 },
    { pkg: 'com.android.vending', nombre: 'Play Store', ultimo: ahora - 12 * DIA, usos: 0 },
  ];
  const MUESTRA_FAVORITAS = [
    'com.movistarplus.androidtv', 'com.google.android.youtube.tv', 'com.filmin.androidtv',
    'com.rtve.androidtv', 'com.antena3.atresplayer.tv', 'org.videolan.vlc', 'com.pecana.iptvextremepro',
  ];
  const MUESTRA_ESTADO = {
    wifi: { ssid: 'MiWifi-5G', rssi: -56, mbps: 433 },
    ram: { total: 2083676160, libre: 688889856 },
    disco: { total: 5419474944, libre: 1322799104 },
    encendida: 3 * 3600 + 12 * 60,
  };
  // Lo que la caja apunta mientras suena algo (sesión multimedia de cada app). Inventado para la muestra.
  const MUESTRA_HISTORIAL = {
    'com.google.android.youtube.tv': [
      { titulo: 'Ruta por La Pedriza en otoño', sub: 'Montaña Madrid', ts: ahora - 3 * HORA, progreso: .62 },
      { titulo: 'Receta de cocido madrileño', sub: 'Cocina de la abuela', ts: ahora - DIA, progreso: 1 },
      { titulo: 'Concierto en directo, Noches del Botánico', sub: 'Música', ts: ahora - 2 * DIA, progreso: .35 },
    ],
    'com.filmin.androidtv': [
      { titulo: 'Anatomía de una caída', sub: 'Película', ts: ahora - DIA - 2 * HORA, progreso: .48 },
      { titulo: 'Perfect Days', sub: 'Película', ts: ahora - 5 * DIA, progreso: 1 },
    ],
    'org.videolan.vlc': [
      { titulo: 'Vacaciones Asturias 2025.mp4', sub: 'Memoria USB', ts: ahora - 6 * DIA, progreso: .2 },
    ],
  };

  let muestraInst = null; // instalación fingida en el PC

  function local(clave) {
    try { return JSON.parse(localStorage.getItem(clave)); } catch (e) { return null; }
  }
  function guardaLocal(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ }
  }

  window.Puente = {
    nativo,

    apps() {
      const lista = nativo ? json(() => window.TVHome.apps(), []) : MUESTRA_APPS;
      return lista.map(a => Object.assign({}, a, linea(a)));
    },

    // Apps de la pantalla de inicio, en orden. En el PC se guardan en localStorage para poder probar el menú.
    favoritas() {
      if (nativo) return json(() => window.TVHome.favoritas(), []);
      return local('home-favoritas') || MUESTRA_FAVORITAS.slice();
    },
    guardaFavoritas(lista) {
      if (nativo) window.TVHome.guardaFavoritas(JSON.stringify(lista));
      else guardaLocal('home-favoritas', lista);
    },

    // Apps ocultas: no salen en ninguna fila; en «Todas las apps» aparecen al final, apagadas.
    ocultas() {
      if (nativo) return json(() => window.TVHome.ocultas(), []);
      return local('home-ocultas') || [];
    },
    guardaOcultas(lista) {
      if (nativo) window.TVHome.guardaOcultas(JSON.stringify(lista));
      else guardaLocal('home-ocultas', lista);
    },

    estado() {
      return nativo ? json(() => window.TVHome.estado(), null) : MUESTRA_ESTADO;
    },

    // Guía de TV de esos canales: { canales: { id: [{ titulo, ini, fin, cat }] } } con horas en segundos.
    async guia(canales) {
      if (nativo) {
        // La caja descarga la guía en segundo plano: mientras tanto contesta {cargando:true}.
        for (let intento = 0; intento < 40; intento++) {
          const r = json(() => window.TVHome.guia(canales.join(',')), null);
          if (!r || !r.cargando) return r;
          await new Promise(ok => setTimeout(ok, 3000));
        }
        return null;
      }
      const r = await fetch('../api/guia.php?canales=' + encodeURIComponent(canales.join(',')));
      return r.ok ? r.json() : null;
    },

    // Lo último que se ha visto con esa app, del más reciente al más antiguo.
    historial(pkg) {
      return nativo ? json(() => window.TVHome.historial(pkg), []) : (MUESTRA_HISTORIAL[pkg] || []);
    },

    // Avisos de programas: [{ id, canal, nombre, titulo, ini, pkg }]. La caja pone una alarma y enseña una tarjeta
    // flotante un minuto antes; en el PC los guarda en localStorage y la página avisa ella misma.
    avisos() {
      return nativo ? json(() => window.TVHome.avisos(), []) : (local('home-avisos') || []);
    },
    ponAviso(a) {
      if (nativo) { window.TVHome.ponAviso(JSON.stringify(a)); return; }
      guardaLocal('home-avisos', this.avisos().filter(x => x.id !== a.id).concat([a]));
    },
    quitaAviso(id) {
      if (nativo) { window.TVHome.quitaAviso(id); return; }
      guardaLocal('home-avisos', this.avisos().filter(x => x.id !== id));
    },

    // Temporizador de apagado en minutos (0 = cancelar) y la hora (ms) a la que se apagará, o 0.
    temporizador(min) {
      if (nativo) { window.TVHome.temporizador(min); return; }
      guardaLocal('home-apagado', min > 0 ? Date.now() + min * 60000 : 0);
    },
    temporizadorFin() {
      const f = nativo ? Number(window.TVHome.temporizadorFin()) : (local('home-apagado') || 0);
      return f > Date.now() ? f : 0;
    },

    // Avisos automáticos: { palabras: [...], canales: { canal: pkg } }. La caja busca en cada guía nueva.
    palabras() {
      const p = nativo ? json(() => window.TVHome.palabras(), null) : local('home-palabras');
      return p && Array.isArray(p.palabras) ? p : { palabras: [], canales: {} };
    },
    guardaPalabras(p) {
      if (nativo) window.TVHome.guardaPalabras(JSON.stringify(p));
      else guardaLocal('home-palabras', p);
    },

    // Mando del móvil: enlace del QR ({ url, caduca, adb }) y móviles emparejados. Lo sirve la propia caja.
    codigoMovil() {
      if (nativo) return json(() => window.TVHome.codigoMovil(), null);
      return { url: 'http://192.168.1.50:8765/e/MUESTRA-sin-valor', caduca: Date.now() / 1000 + 300, adb: 'conectado' };
    },
    estadoAdb() {
      return nativo ? window.TVHome.estadoAdb() : 'conectado';
    },
    moviles() {
      return nativo ? json(() => window.TVHome.moviles(), []) : (local('home-moviles') || [{ id: 'demo1', nombre: 'Pixel 8', creado: Date.now() - 86400000 }]);
    },
    quitaMovil(id) {
      if (nativo) { window.TVHome.quitaMovil(id); return; }
      guardaLocal('home-moviles', this.moviles().filter(m => m.id !== id));
    },

    // Instalar app: los .apk de la caja, instalar uno y cómo va (también lo que llega del móvil).
    // En el PC, una muestra que finge tardar unos segundos.
    apks() {
      if (nativo) return json(() => window.TVHome.apks(), []);
      return [
        { ruta: '/storage/1A2B-3C4D/Kodi-21.1.apk', archivo: 'Kodi-21.1.apk', nombre: 'Kodi', pkg: 'org.xbmc.kodi', version: '21.1', tam: 81788928, origen: 'USB' },
        { ruta: '/storage/emulated/0/Download/SmartTube.apk', archivo: 'SmartTube.apk', nombre: 'SmartTube', pkg: 'com.teamsmart.videomanager.tv', version: '25.40', tam: 22020096, origen: 'Descargas' },
        { ruta: '/storage/1A2B-3C4D/vlc.apk', archivo: 'vlc.apk', nombre: 'VLC', pkg: 'org.videolan.vlc', version: '3.6.2', tam: 44040192, origen: 'USB', instalada: '3.6.0', comparada: 'nueva' },
        { ruta: '/storage/1A2B-3C4D/viejo.apk', archivo: 'viejo.apk', tam: 1048576, origen: 'USB', roto: true },
      ];
    },
    instalaApk(ruta) {
      if (nativo) return window.TVHome.instalaApk(ruta);
      const a = this.apks().find(x => x.ruta === ruta);
      muestraInst = { ini: Date.now(), nombre: a.nombre || a.archivo, pkg: a.pkg, roto: !!a.roto };
      return true;
    },
    instalacion() {
      if (nativo) return json(() => window.TVHome.instalacion(), {});
      if (!muestraInst) return {};
      const m = muestraInst, listo = Date.now() - m.ini > 3500;
      if (!listo) return { fase: 'instalando', nombre: m.nombre, origen: 'caja', pct: 100 };
      return m.roto ? { fase: 'error', nombre: m.nombre, origen: 'caja', error: 'El archivo no es un APK válido o está dañado.' }
        : { fase: 'hecha', nombre: m.nombre, pkg: m.pkg, origen: 'caja', abrible: true, t: m.ini };
    },

    buscaYouTube(q) {
      if (nativo) { window.TVHome.buscaYouTube(q); return; }
      console.log('[muestra] buscar en YouTube', q);
    },

    // Con url, la abre dentro de esa app (un canal en directo); si la app no la entiende, abre la app.
    abrir(pkg, url) {
      if (nativo) { if (url) window.TVHome.abrirEnlace(pkg, url); else window.TVHome.abrir(pkg); return; }
      console.log('[muestra] abrir', pkg, url || '');
    },

    sistema(accion) {
      if (nativo) { window.TVHome.sistema(accion); return; }
      console.log('[muestra] sistema', accion);
    },
  };
})();
