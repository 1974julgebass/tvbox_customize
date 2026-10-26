/*
 * Panel de la TV box. Comprueba la conexión ADB (api/estado.php, cada 15 s): sin conexión
 * enseña los pasos para activarla; conectada enseña la pantalla, el mando y las secciones.
 * El teclado del PC hace de mando solo cuando la pantalla o el mando tienen el foco.
 */
(function () {
  'use strict';

  var CSRF = document.querySelector('meta[name="csrf-token"]').content;
  var $ = function (id) { return document.getElementById(id); };
  var state = { estado: null, apps: [], ajustes: {}, connected: null };

  // ── Utilidades ─────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function api(url, opts) {
    opts = opts || {};
    var init = { method: 'GET', headers: { 'X-CSRF-Token': CSRF }, credentials: 'same-origin' };
    if (opts.json) { init.method = 'POST'; init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.json); }
    if (opts.form) { init.method = 'POST'; init.body = opts.form; }
    return fetch(url, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok || data.error) throw new Error(data.error || ('Error ' + r.status));
        return data;
      });
    });
  }
  function toast(msg, bad) {
    var t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, bad ? 6000 : 3500);
    setTimeout(function () { t.remove(); }, bad ? 6500 : 4000);
  }
  function ask(title, text, okLabel, danger) {
    var d = $('confirm');
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    $('confirmOk').textContent = okLabel || 'Seguir';
    $('confirmOk').classList.toggle('btn-danger', !!danger);
    d.returnValue = '';
    d.showModal();
    return new Promise(function (resolve) {
      d.addEventListener('close', function h() { d.removeEventListener('close', h); resolve(d.returnValue === 'si'); });
    });
  }
  function busy(btn, on) { btn.classList.toggle('is-busy', on); btn.disabled = on; }
  function fmtBytes(n) {
    if (n == null) return '—';
    if (n >= 1073741824) return (n / 1073741824).toFixed(1).replace('.', ',') + ' GB';
    if (n >= 1048576) return Math.round(n / 1048576) + ' MB';
    return Math.round(n / 1024) + ' KB';
  }
  function fmtUptime(s) {
    if (!s) return '—';
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    if (d) return d + ' d ' + h + ' h';
    if (h) return h + ' h ' + m + ' min';
    return m + ' min';
  }

  // ── Tema y tooltips ───────────────────────────────────────
  function currentTheme() {
    return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function paintThemeIcon() { $('btnTheme').querySelector('use').setAttribute('href', currentTheme() === 'dark' ? '#i-sun' : '#i-moon'); }
  $('btnTheme').addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('tv-theme', next); } catch (e) {}
    paintThemeIcon();
  });
  paintThemeIcon();

  (function () {
    var tip = document.createElement('div');
    tip.className = 'tip';
    document.body.appendChild(tip);
    document.addEventListener('pointerover', function (e) {
      var el = e.target.closest('[data-tip]');
      if (!el) return;
      tip.textContent = el.dataset.tip;
      var r = el.getBoundingClientRect();
      tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
      tip.style.top = (r.bottom + 8) + 'px';
      tip.classList.add('on');
    });
    document.addEventListener('pointerdown', function () { tip.classList.remove('on'); });
    document.addEventListener('pointerout', function (e) { if (e.target.closest('[data-tip]')) tip.classList.remove('on'); });
  })();

  // ── Nombres de apps conocidas ─────────────────────────────
  var APP_NAMES = {
    'com.google.android.youtube.tv': 'YouTube', 'com.google.android.youtube.tvmusic': 'YouTube Music',
    'com.google.android.youtube.tvkids': 'YouTube Kids', 'com.netflix.ninja': 'Netflix',
    'com.amazon.amazonvideo.livingroom': 'Prime Video', 'com.disney.disneyplus': 'Disney+',
    'com.wbd.stream': 'Max', 'com.hbo.hbonow': 'HBO Max', 'es.plus.yomvi': 'Movistar Plus+',
    'com.spotify.tv.android': 'Spotify', 'org.xbmc.kodi': 'Kodi', 'com.plexapp.android': 'Plex',
    'tv.twitch.android.app': 'Twitch', 'com.dazn': 'DAZN', 'com.rtve.androidtv': 'RTVE Play',
    'com.apple.atve.androidtv.appletv': 'Apple TV', 'com.skyshowtime.skyshowtime.google': 'SkyShowtime',
    'com.atresmedia.atresplayer': 'Atresplayer', 'es.mediaset.mitelenow': 'Mitele', 'com.filmin.filmin': 'Filmin',
    'com.android.vending': 'Google Play Store', 'com.google.android.tvlauncher': 'Inicio de Android TV',
    'com.google.android.leanbacklauncher': 'Inicio de Android TV', 'com.google.android.apps.tv.launcherx': 'Inicio de Google TV',
    'com.google.android.katniss': 'Asistente de Google', 'com.android.tv.settings': 'Ajustes',
    'com.google.android.tvrecommendations': 'Recomendaciones', 'com.mitv.tvhome': 'PatchWall',
    'com.google.android.play.games': 'Play Juegos', 'com.google.android.apps.mediashell': 'Chromecast integrado',
    'com.google.android.backdrop': 'Salvapantallas (Ambient)', 'com.google.android.tv.remote.service': 'Mando a distancia',
    'com.android.chrome': 'Chrome', 'org.videolan.vlc': 'VLC', 'com.google.android.gms': 'Servicios de Google Play',
    'com.android.providers.downloads': 'Descargas', 'com.google.android.inputmethod.latin': 'Teclado Gboard',
    'com.google.android.tts': 'Voz de Google', 'com.google.android.tv': 'Live Channels',
  };
  function appName(pkg) {
    if (APP_NAMES[pkg]) return APP_NAMES[pkg];
    var parts = pkg.split('.').filter(function (p) { return !/^(com|org|net|tv|es|android|google|app|apps|mobile)$/.test(p); });
    var n = parts.length ? parts[parts.length - 1] : pkg;
    return n.charAt(0).toUpperCase() + n.slice(1).replace(/_/g, ' ');
  }
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }

  // ── Estado y conexión ─────────────────────────────────────
  var pending = {};
  function setTitle(el, html) {
    if (el.dataset.animating) { pending[el.id] = html; return; }
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  ['obTitle', 'stTitle'].forEach(function (id) {
    $(id).addEventListener('intro-done', function () { if (pending[id]) { setTitle($(id), pending[id]); delete pending[id]; } });
  });

  function setChip(cls, text) {
    var c = $('liveChip');
    c.className = 'chip' + (cls ? ' ' + cls : '');
    c.querySelector('span').textContent = text;
  }

  function renderDisconnected(e) {
    $('onboard').hidden = false;
    $('mando').hidden = true;
    $('connected').hidden = true;
    $('topNav').hidden = true;
    stopLive();

    var diag;
    if (!e.adb) {
      setChip('bad', 'Falta adb');
      setTitle($('obTitle'), 'Falta adb en el PC');
      $('obLead').textContent = 'No encuentro adb.exe en la ruta de ADB_PATH (.env). Instálalo con «winget install Google.PlatformTools».';
      diag = 'ADB_PATH no apunta a un adb.exe';
    } else if (e.estado === 'unauthorized') {
      setChip('warn', 'Esperando permiso');
      $('obEyebrow').textContent = 'Casi está';
      setTitle($('obTitle'), 'Acepta el aviso en la tele');
      $('obLead').textContent = 'La tele pregunta si permite la depuración desde este ordenador. Marca «Permitir siempre» y acepta; el panel se conecta solo.';
      diag = 'ADB conectado a ' + e.host + ':' + e.puerto + ' · <b>sin autorizar todavía</b>';
    } else if (e.puerto_abierto) {
      setChip('warn', 'Sin conectar');
      $('obEyebrow').textContent = 'Lista para conectar';
      setTitle($('obTitle'), 'La depuración está activa');
      $('obLead').textContent = 'La tele ya escucha en el puerto ' + e.puerto + '. Pulsa «Conectar ahora» y acepta el aviso que sale en pantalla.';
      diag = 'Puerto ' + e.puerto + ' de ' + e.host + ' <b>abierto</b> · sin sesión ADB';
    } else {
      setChip('bad', 'Sin conexión');
      $('obEyebrow').textContent = 'Sin conexión';
      setTitle($('obTitle'), 'Falta un paso en la tele');
      $('obLead').textContent = 'Para que el PC pueda manejarla hay que activar la depuración en la TV box una sola vez. Si ya lo hiciste, puede que esté en reposo: enciéndela con el mando.';
      diag = 'Puerto ' + e.puerto + ' de ' + e.host + ' <b>cerrado o sin respuesta</b> · depuración apagada o tele en reposo';
    }
    $('diag').innerHTML = diag;
  }

  function renderConnected(e) {
    var first = state.connected !== true;
    $('onboard').hidden = true;
    $('mando').hidden = false;
    $('connected').hidden = false;
    $('topNav').hidden = false;
    var i = e.info || {};
    $('topModel').textContent = [i.fabricante, i.modelo].filter(Boolean).join(' ') + ' · ' + e.host;

    var screenOn = i.pantalla === 'awake';
    var app = i.app ? appName(i.app) : '';
    setChip(screenOn ? 'ok' : 'warn', screenOn ? (app ? 'En ' + app : 'Encendida') : 'Pantalla en reposo');
    $('stEyebrow').textContent = 'Conectada · Android ' + (i.android || '?');
    var title = !screenOn ? 'Pantalla <span class="soft">en reposo</span>'
      : (app && !/Inicio/.test(app) ? 'Viendo <span class="soft">' + esc(app) + '</span>' : 'En el <span class="soft">inicio</span>');
    setTitle($('stTitle'), title);
    var lead = [];
    if (i.encendida_s) lead.push('Encendida hace ' + fmtUptime(i.encendida_s));
    if (i.ram_total && i.ram_libre != null) lead.push(fmtBytes(i.ram_libre) + ' de memoria libre');
    if (i.disco_libre != null) lead.push(fmtBytes(i.disco_libre) + ' libres');
    if (i.temperatura) lead.push(String(i.temperatura).replace('.', ',') + ' °C');
    $('stLead').textContent = lead.join(' · ');

    if (i.volumen) {
      $('vol').hidden = false;
      $('volFill').style.width = Math.round(i.volumen.nivel / i.volumen.max * 100) + '%';
      $('volText').textContent = i.volumen.nivel + '/' + i.volumen.max;
    }

    renderSystem(i);
    renderAppsList();
    state.connected = true;
    if (first) {
      loadApps();
      loadSettings();
      takeShot();
      if (window.PanelScroll) window.PanelScroll.sections();
    }
  }

  function loadEstado() {
    return api('api/estado.php').then(function (e) {
      state.estado = e;
      if (e.estado === 'device' && e.info) renderConnected(e);
      else { state.connected = false; renderDisconnected(e); }
    }).catch(function (err) {
      setChip('bad', 'Error');
      toast(err.message, true);
    }).then(function () {
      if (window.PanelScroll) window.PanelScroll.intro();
    });
  }

  $('btnConnect').addEventListener('click', function () {
    var btn = this, msg = $('connectMsg');
    busy(btn, true);
    msg.className = 'form-msg';
    msg.textContent = 'Conectando… (hasta 10 s)';
    api('api/conectar.php', { json: { accion: 'conectar' } }).then(function (d) {
      if (d.estado === 'device') { msg.textContent = ''; toast('Conectada'); }
      else if (d.estado === 'unauthorized') { msg.className = 'form-msg'; msg.textContent = 'Mira la tele: pide permiso para este PC.'; }
      else { msg.className = 'form-msg bad'; msg.textContent = /refused|rechaz|10061/i.test(d.mensaje) ? 'La tele rechaza la conexión: la depuración está apagada.' : 'La tele no contesta. ¿Está encendida y con la depuración activada?'; }
      return loadEstado();
    }).catch(function (err) { msg.className = 'form-msg bad'; msg.textContent = err.message; })
      .then(function () { busy(btn, false); });
  });

  $('pairForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = new FormData(this), btn = this.querySelector('button');
    busy(btn, true);
    api('api/conectar.php', { json: { accion: 'emparejar', destino: f.get('destino').trim(), codigo: f.get('codigo').trim() } })
      .then(function () { toast('Vinculada'); return loadEstado(); })
      .catch(function (err) { toast(err.message, true); })
      .then(function () { busy(btn, false); });
  });

  $('btnDisconnect').addEventListener('click', function () {
    ask('¿Desconectar este PC?', 'El panel deja de manejar la tele hasta que pulses «Conectar ahora». La autorización se mantiene.', 'Desconectar').then(function (yes) {
      if (!yes) return;
      api('api/conectar.php', { json: { accion: 'desconectar' } }).then(loadEstado);
    });
  });

  // ── Pantalla ──────────────────────────────────────────────
  var live = false, liveTimer = null, shotBusy = false, lastUrl = null;
  function takeShot() {
    if (shotBusy) return Promise.resolve();
    shotBusy = true;
    $('tv').classList.add('loading');
    return fetch('api/captura.php', { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok || !/image/.test(r.headers.get('Content-Type') || '')) return r.json().then(function (d) { throw new Error(d.error || 'Sin captura'); });
      return r.blob();
    }).then(function (b) {
      var url = URL.createObjectURL(b);
      var img = $('shot');
      img.onload = function () { if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = url; };
      img.src = url;
      img.hidden = false;
      $('tvEmpty').hidden = true;
      var save = $('btnSave');
      save.href = url;
      save.download = 'tele_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
      save.hidden = false;
    }).catch(function (err) {
      if (!live) toast(err.message, true);
    }).then(function () {
      shotBusy = false;
      $('tv').classList.remove('loading');
    });
  }
  function loopLive() {
    if (!live) return;
    takeShot().then(function () { if (live) liveTimer = setTimeout(loopLive, document.hidden ? 4000 : 600); });
  }
  function stopLive() {
    live = false;
    clearTimeout(liveTimer);
    $('btnLive').setAttribute('aria-pressed', 'false');
    $('liveBadge').hidden = true;
  }
  $('btnShot').addEventListener('click', takeShot);
  $('btnLive').addEventListener('click', function () {
    if (live) { stopLive(); return; }
    live = true;
    this.setAttribute('aria-pressed', 'true');
    $('liveBadge').hidden = false;
    loopLive();
  });

  // Tras pulsar teclas, una captura nueva (si no está en vivo) para ver el resultado.
  var afterKeyTimer = null;
  function shotSoon() {
    if (live) return;
    clearTimeout(afterKeyTimer);
    afterKeyTimer = setTimeout(takeShot, 700);
  }

  // ── Mando ─────────────────────────────────────────────────
  // Las teclas van en fila: si se mandan en paralelo llegan a la tele desordenadas.
  var keyQueue = Promise.resolve();
  function sendKey(name, el) {
    if (el) { el.classList.add('pressed'); setTimeout(function () { el.classList.remove('pressed'); }, 140); }
    keyQueue = keyQueue.then(function () {
      return api('api/mando.php', { json: { tecla: name } }).then(function () {
        if (/^vol_|silencio/.test(name)) setTimeout(loadEstado, 300);
        if (name === 'dormir' || name === 'encender') setTimeout(loadEstado, 1200);
        shotSoon();
      }).catch(function (err) { toast(err.message, true); });
    });
    return keyQueue;
  }
  $('remote').addEventListener('click', function (e) {
    var b = e.target.closest('[data-key]');
    if (b) sendKey(b.dataset.key, b);
  });

  $('typeForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('typeText').value;
    if (!t.trim()) return;
    api('api/mando.php', { json: { texto: t } }).then(function () {
      $('typeText').value = '';
      toast('Texto enviado');
      shotSoon();
    }).catch(function (err) { toast(err.message, true); });
  });

  // Teclado del PC como mando: solo con la pantalla o el mando enfocados.
  var kbdActive = false;
  function setKbd(on) {
    kbdActive = on;
    $('tv').classList.toggle('focus', on);
    $('remote').classList.toggle('focus', on);
  }
  $('tv').addEventListener('click', function () { setKbd(true); $('tv').focus(); });
  $('remote').addEventListener('pointerdown', function (e) { if (!e.target.closest('input')) setKbd(true); });
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest('#tv, #remote')) setKbd(false); });
  var KEYMAP = {
    ArrowUp: 'arriba', ArrowDown: 'abajo', ArrowLeft: 'izquierda', ArrowRight: 'derecha', Enter: 'ok',
    Backspace: 'atras', Escape: 'atras', Home: 'inicio', h: 'inicio', m: 'menu', '+': 'vol_mas', '-': 'vol_menos',
    ' ': 'reproducir', MediaPlayPause: 'reproducir',
  };
  var btnFor = { arriba: '.dp.up', abajo: '.dp.down', izquierda: '.dp.left', derecha: '.dp.right', ok: '.dp.ok' };
  document.addEventListener('keydown', function (e) {
    if (!kbdActive || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target.closest('input, textarea')) return;
    var k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault();
    var el = btnFor[k] ? document.querySelector(btnFor[k]) : document.querySelector('.rk[data-key="' + k + '"]');
    sendKey(k, el);
  });

  // ── Apps ──────────────────────────────────────────────────
  function loadApps() {
    return api('api/apps.php').then(function (d) { state.apps = d.apps || []; renderAppsList(); })
      .catch(function (err) { $('appList').innerHTML = '<li class="empty muted">' + esc(err.message) + '</li>'; });
  }
  function currentTab() { return document.querySelector('input[name="apptab"]:checked').value; }
  function renderAppsList() {
    var apps = state.apps;
    if (!apps.length) return;
    $('cUser').textContent = apps.filter(function (a) { return !a.sistema; }).length;
    $('cSys').textContent = apps.filter(function (a) { return a.sistema; }).length;
    $('cDis').textContent = apps.filter(function (a) { return a.desactivada; }).length;
    var tab = currentTab();
    var q = $('appSearch').value.trim().toLowerCase();
    var running = state.estado && state.estado.info ? state.estado.info.app : '';
    var list = apps.filter(function (a) {
      if (tab === 'user' && a.sistema) return false;
      if (tab === 'system' && !a.sistema) return false;
      if (tab === 'disabled' && !a.desactivada) return false;
      return !q || a.paquete.toLowerCase().indexOf(q) >= 0 || appName(a.paquete).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return appName(a.paquete).localeCompare(appName(b.paquete), 'es'); });

    $('appList').innerHTML = list.length ? list.map(function (a) {
      var n = appName(a.paquete);
      return '<li class="app' + (a.desactivada ? ' off' : '') + (a.paquete === running ? ' running' : '') + '" data-pkg="' + esc(a.paquete) + '" data-system="' + (a.sistema ? 1 : 0) + '" data-off="' + (a.desactivada ? 1 : 0) + '">'
        + '<span class="app-ico" style="--h:' + hue(a.paquete) + '">' + esc(n.charAt(0)) + '</span>'
        + '<span><span class="app-name">' + esc(n) + '</span><span class="app-pkg">' + esc(a.paquete) + '</span></span>'
        + '<span class="app-acts">' + (a.desactivada ? '' : '<button class="icon-btn" data-app="abrir" data-tip="Abrir en la tele"><svg class="ico"><use href="#i-play"/></svg></button>')
        + '<button class="icon-btn" data-app="mas" data-tip="Más"><svg class="ico"><use href="#i-more"/></svg></button></span></li>';
    }).join('') : '<li class="empty muted">' + (q ? 'Ninguna app coincide.' : 'No hay apps en esta lista.') + '</li>';
  }
  document.querySelectorAll('input[name="apptab"]').forEach(function (r) { r.addEventListener('change', renderAppsList); });
  $('appSearch').addEventListener('input', renderAppsList);

  function closeMenus() { document.querySelectorAll('.menu').forEach(function (m) { m.remove(); }); }
  document.addEventListener('click', function (e) { if (!e.target.closest('.menu, [data-app="mas"]')) closeMenus(); });

  function appAction(action, pkg) {
    return api('api/apps.php', { json: { accion: action, paquete: pkg } }).then(function () {
      var msgs = { abrir: 'Abriendo ' + appName(pkg), cerrar: appName(pkg) + ' cerrada', desactivar: appName(pkg) + ' desactivada', activar: appName(pkg) + ' activada', desinstalar: appName(pkg) + ' desinstalada' };
      toast(msgs[action]);
      if (action === 'abrir' || action === 'cerrar') { shotSoon(); setTimeout(loadEstado, 1500); }
      else loadApps();
    }).catch(function (err) { toast(err.message, true); });
  }

  $('appList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-app]');
    if (!b) return;
    var li = b.closest('.app'), pkg = li.dataset.pkg, sys = li.dataset.system === '1', off = li.dataset.off === '1';
    if (b.dataset.app === 'abrir') { appAction('abrir', pkg); return; }
    if (b.dataset.app === 'mas') {
      var had = li.querySelector('.menu');
      closeMenus();
      if (had) return;
      var m = document.createElement('div');
      m.className = 'menu';
      m.innerHTML = (off ? '' : '<button data-do="cerrar">Forzar cierre</button>')
        + (off ? '<button data-do="activar">Activar</button>' : '<button data-do="desactivar" class="danger">Desactivar</button>')
        + (sys ? '' : '<button data-do="desinstalar" class="danger">Desinstalar</button>');
      b.parentNode.appendChild(m);
      m.addEventListener('click', function (ev) {
        var d = ev.target.closest('[data-do]');
        if (!d) return;
        closeMenus();
        var act = d.dataset.do, n = appName(pkg);
        if (act === 'desactivar') {
          ask('¿Desactivar ' + n + '?', (sys ? 'Es una app del sistema: si la tele la necesita, algo puede dejar de funcionar. ' : '') + 'Desaparece del menú y no se ejecuta, pero no se borra: la recuperas con «Activar» en la pestaña Desactivadas.', 'Desactivar', true)
            .then(function (y) { if (y) appAction('desactivar', pkg); });
        } else if (act === 'desinstalar') {
          ask('¿Desinstalar ' + n + '?', 'Se borra de la tele con sus datos (sesiones iniciadas, ajustes). Para recuperarla habrá que instalarla otra vez.', 'Desinstalar', true)
            .then(function (y) { if (y) appAction('desinstalar', pkg); });
        } else {
          appAction(act, pkg);
        }
      });
    }
  });

  $('apkFile').addEventListener('change', function () {
    var f = this.files[0];
    if (!f) return;
    var input = this;
    if (f.size > 38 * 1048576) { toast('El APK pasa de 38 MB, el límite de subida de PHP.', true); input.value = ''; return; }
    ask('¿Instalar ' + f.name + '?', 'Se instala en la tele (o se actualiza si ya estaba). Instala solo APK de sitios de confianza.', 'Instalar').then(function (yes) {
      if (!yes) { input.value = ''; return; }
      var fd = new FormData();
      fd.append('apk', f);
      toast('Instalando ' + f.name + '…');
      api('api/instalar.php', { form: fd }).then(function () { toast(f.name + ' instalado'); loadApps(); })
        .catch(function (err) { toast(err.message, true); })
        .then(function () { input.value = ''; });
    });
  });

  // ── Enviar ────────────────────────────────────────────────
  $('urlForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var url = $('urlText').value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && /^[\w-]+(\.[\w-]+)+/.test(url)) url = 'https://' + url;
    var btn = this.querySelector('button');
    busy(btn, true);
    api('api/sistema.php', { json: { accion: 'abrir_url', url: url } }).then(function () {
      toast('Abierto en la tele');
      $('urlText').value = '';
      shotSoon();
    }).catch(function (err) { toast(err.message, true); }).then(function () { busy(btn, false); });
  });

  // ── Ajustes ───────────────────────────────────────────────
  function loadSettings() {
    return api('api/ajustes.php').then(function (d) { state.ajustes = d.ajustes || {}; renderSettings(); }).catch(function () {});
  }
  function renderSettings() {
    Object.keys(state.ajustes).forEach(function (k) {
      var v = state.ajustes[k];
      if (k === 'animaciones' && (v === 'null' || v === '1.0')) v = '1';
      if (k === 'animaciones' && v === '0.0') v = '0';
      var r = document.querySelector('input[name="' + k + '"][value="' + v + '"]');
      document.querySelectorAll('input[name="' + k + '"]').forEach(function (x) { x.checked = false; });
      if (r) r.checked = true;
    });
    renderChecks();
  }
  $('settings').addEventListener('change', function (e) {
    var r = e.target;
    if (!r.matches('input[type="radio"]')) return;
    var seg = r.closest('.seg');
    seg.classList.add('saving');
    api('api/ajustes.php', { json: { ajuste: r.name, valor: r.value } }).then(function (d) {
      state.ajustes = d.ajustes || state.ajustes;
      renderSettings();
      toast('Ajuste aplicado en la tele');
    }).catch(function (err) { toast(err.message, true); renderSettings(); })
      .then(function () { seg.classList.remove('saving'); });
  });

  // ── Sistema y mejoras ─────────────────────────────────────
  function meter(label, used, total, extra) {
    var pct = total ? Math.round(used / total * 100) : 0;
    var cls = pct > 90 ? 'bad' : pct > 80 ? 'warn' : '';
    return '<div class="meter ' + cls + '"><b>' + esc(extra || (pct + ' %')) + '</b><span>' + esc(label) + '</span><div class="bar"><i style="width:' + pct + '%"></i></div></div>';
  }
  function renderSystem(i) {
    var m = [];
    if (i.ram_total) m.push(meter('memoria en uso · ' + fmtBytes(i.ram_total) + ' en total', i.ram_total - (i.ram_libre || 0), i.ram_total));
    if (i.disco_total) m.push(meter('almacenamiento en uso · ' + fmtBytes(i.disco_libre) + ' libres', i.disco_total - (i.disco_libre || 0), i.disco_total));
    m.push('<div class="meter"><b>' + (i.temperatura ? String(i.temperatura).replace('.', ',') + ' °C' : '—') + '</b><span>temperatura del procesador</span></div>');
    m.push('<div class="meter"><b>' + (i.wifi_rssi != null ? i.wifi_rssi + ' dBm' : (i.cable ? 'Cable' : '—')) + '</b><span>' + (i.wifi_rssi != null ? 'señal wifi' + (i.wifi_ghz ? ' · ' + String(i.wifi_ghz).replace('.', ',') + ' GHz' : '') : 'conexión') + '</span></div>');
    $('meters').innerHTML = m.join('');

    var specs = [
      ['Equipo', [['Fabricante', i.fabricante], ['Modelo', i.modelo], ['Código', i.dispositivo], ['Nombre', i.nombre], ['Encendida', fmtUptime(i.encendida_s)]]],
      ['Software', [['Android', i.android ? i.android + ' (API ' + i.sdk + ')' : null], ['Compilación', i.compilacion], ['Parche de seguridad', i.parche]]],
      ['Red y pantalla', [['IP', i.ip], ['Cable', i.cable], ['Wifi', i.wifi_ssid], ['Velocidad', i.wifi_mbps ? i.wifi_mbps + ' Mbps' : null], ['Resolución', i.resolucion], ['Densidad', i.densidad ? i.densidad + ' ppp' : null]]],
    ];
    $('specs').innerHTML = specs.map(function (s) {
      return '<div class="panel spec"><h3>' + esc(s[0]) + '</h3><dl>' + s[1].filter(function (r) { return r[1]; }).map(function (r) {
        return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
      }).join('') + '</dl></div>';
    }).join('');
    renderChecks();
  }

  function renderChecks() {
    var e = state.estado;
    if (!e || !e.info) return;
    var i = e.info, a = state.ajustes, items = [];

    var anim = a.animaciones || (i.animaciones ? String(i.animaciones[0]) : '1');
    if (anim === '1' || anim === '1.0' || anim === 'null') {
      items.push({ n: 'info', t: 'Los menús pueden ir más ágiles', x: 'Las animaciones están a velocidad normal. Ponerlas en «Rápida» hace que la caja parezca bastante más rápida sin perder nada.', a: [{ l: 'Poner en rápida', set: ['animaciones', '0.5'] }] });
    } else {
      items.push({ n: 'ok', t: 'Animaciones aceleradas', x: 'Los menús ya van con animaciones ' + (anim === '0' || anim === '0.0' ? 'desactivadas' : 'cortas') + '.' });
    }

    if (i.disco_total) {
      var freePct = Math.round((i.disco_libre || 0) / i.disco_total * 100);
      if (freePct < 10) items.push({ n: 'bad', t: 'Casi sin espacio', x: 'Solo queda un ' + freePct + ' % libre (' + fmtBytes(i.disco_libre) + '). Con tan poco espacio las apps se actualizan mal y la caja se vuelve lenta. Libera caché o desinstala apps que no uses.', a: [{ l: 'Liberar caché', sys: 'liberar_cache' }] });
      else if (freePct < 20) items.push({ n: 'warn', t: 'Queda poco espacio', x: 'Un ' + freePct + ' % libre (' + fmtBytes(i.disco_libre) + '). Conviene liberar caché de vez en cuando.', a: [{ l: 'Liberar caché', sys: 'liberar_cache' }] });
      else items.push({ n: 'ok', t: 'Espacio suficiente', x: fmtBytes(i.disco_libre) + ' libres de ' + fmtBytes(i.disco_total) + '.' });
    }

    if (i.ram_total && i.ram_libre != null && i.ram_libre / i.ram_total < .2) {
      items.push({ n: 'info', t: 'Memoria justa', x: 'Quedan ' + fmtBytes(i.ram_libre) + ' libres. Si la caja va a tirones, cerrar las apps en segundo plano ayuda.', a: [{ l: 'Cerrar apps en segundo plano', sys: 'cerrar_fondo' }] });
    }

    if (i.cable) items.push({ n: 'ok', t: 'Conectada por cable', x: 'La conexión más estable para streaming.' });
    else if (i.wifi_rssi != null) {
      if (i.wifi_rssi < -72) items.push({ n: 'warn', t: 'Señal wifi floja', x: 'La caja recibe ' + i.wifi_rssi + ' dBm. Por debajo de -70 el 4K se corta o baja de calidad. Acercar el router, un nodo Easymesh o un cable Ethernet lo arreglan.' });
      else items.push({ n: 'ok', t: 'Buena señal wifi', x: i.wifi_rssi + ' dBm' + (i.wifi_mbps ? ' · ' + i.wifi_mbps + ' Mbps de enlace' : '') + '.' });
      if (i.wifi_ghz && i.wifi_ghz < 3) items.push({ n: 'info', t: 'Conectada a 2,4 GHz', x: 'La banda de 5 GHz es más rápida y tiene menos interferencias. Si la señal llega, conéctala a la red de 5 GHz del router.' });
    }

    if (i.temperatura && i.temperatura > 75) items.push({ n: 'warn', t: 'Se calienta', x: 'El procesador está a ' + String(i.temperatura).replace('.', ',') + ' °C. Déjale aire alrededor; si está encerrada en un mueble, se frena sola para no quemarse.' });

    if (i.parche) {
      var age = (Date.now() - new Date(i.parche).getTime()) / (365 * 86400000);
      if (age > 2) items.push({ n: 'info', t: 'Parche de seguridad antiguo', x: 'El último es de ' + i.parche + '. Xiaomi ya no actualiza esta caja a menudo: no instales APK de sitios dudosos.' });
    }

    if (a.suspension === '-1') items.push({ n: 'info', t: 'Nunca se suspende', x: 'Así el panel siempre la encuentra, pero gasta luz toda la noche. «4 h» es un buen término medio.' });

    items.push({ n: 'info', t: 'La depuración está activada', x: 'Es lo que deja que el panel maneje la tele. Otro aparato necesitaría que aceptes un aviso en pantalla para hacer lo mismo, así que es seguro dejarla; si dejas de usar el panel, puedes apagarla en Opciones para desarrolladores.' });

    var order = { bad: 0, warn: 1, info: 2, ok: 3 };
    items.sort(function (x, y) { return order[x.n] - order[y.n]; });
    var ico = { bad: 'i-alert', warn: 'i-alert', info: 'i-info', ok: 'i-check' };
    $('checks').innerHTML = items.map(function (it) {
      var acts = (it.a || []).map(function (ac) {
        if (ac.set) return '<button class="link-btn" type="button" data-set="' + ac.set[0] + '" data-val="' + ac.set[1] + '">' + esc(ac.l) + '</button>';
        return '<button class="link-btn" type="button" data-sys="' + ac.sys + '">' + esc(ac.l) + '</button>';
      }).join('');
      return '<li class="check ' + it.n + '"><span class="check-ico"><svg class="ico"><use href="#' + ico[it.n] + '"/></svg></span><h3>' + esc(it.t) + '</h3><p>' + esc(it.x) + '</p>'
        + (acts ? '<div class="check-act">' + acts + '</div>' : '') + '</li>';
    }).join('');
  }

  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-set]');
    if (s) {
      var r = document.querySelector('input[name="' + s.dataset.set + '"][value="' + s.dataset.val + '"]');
      if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      return;
    }
    var b = e.target.closest('[data-sys]');
    if (!b) return;
    var act = b.dataset.sys;
    var go = function () {
      busy(b, true);
      return api('api/sistema.php', { json: { accion: act } }).then(function (d) {
        if (act === 'liberar_cache') toast('Caché liberada' + (d.liberado ? ': ' + fmtBytes(d.liberado) : ''));
        else if (act === 'cerrar_fondo') toast('Apps en segundo plano cerradas');
        else if (act === 'reiniciar') { toast('Reiniciando la tele… vuelve en un minuto'); state.connected = false; }
        else toast('Hecho');
        setTimeout(loadEstado, act === 'reiniciar' ? 4000 : 800);
        shotSoon();
      }).catch(function (err) { toast(err.message, true); }).then(function () { busy(b, false); });
    };
    if (act === 'reiniciar') {
      ask('¿Reiniciar la tele?', 'Se corta lo que esté reproduciendo y tarda un minuto en volver. El panel se reconecta solo cuando arranque.', 'Reiniciar', true).then(function (y) { if (y) go(); });
    } else go();
  });

  // ── Arranque y refresco ───────────────────────────────────
  $('btnRefresh').addEventListener('click', function () {
    var b = this;
    b.classList.add('spin');
    var jobs = [loadEstado()];
    if (state.connected) jobs.push(loadApps(), loadSettings());
    Promise.all(jobs).then(function () { b.classList.remove('spin'); });
  });

  loadEstado();
  setInterval(function () { if (!document.hidden) loadEstado(); }, 15000);
  // Tras reiniciar o si se cortó: un intento de reconexión cada minuto mientras el panel esté abierto.
  setInterval(function () {
    var e = state.estado;
    if (document.hidden || !e || !e.adb || e.estado === 'device' || !e.puerto_abierto) return;
    api('api/conectar.php', { json: { accion: 'conectar' } }).then(loadEstado).catch(function () {});
  }, 60000);
})();
