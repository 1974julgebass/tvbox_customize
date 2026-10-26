<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/boot.php';

$h = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$v = fn(string $f): string => (string)@filemtime(__DIR__ . '/' . $f);
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="<?= $h(csrf_token()) ?>">
  <title>TV box · Xiaomi</title>
  <link rel="icon" href="img/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/tvbox.css?v=<?= $v('css/tvbox.css') ?>">
  <script>
    try { var t = localStorage.getItem('tv-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  </script>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-tv" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8M12 18v3"/></symbol>
  <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></symbol>
  <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
  <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></symbol>
  <symbol id="i-power" viewBox="0 0 24 24"><path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></symbol>
  <symbol id="i-up" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></symbol>
  <symbol id="i-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>
  <symbol id="i-left" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></symbol>
  <symbol id="i-right" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></symbol>
  <symbol id="i-back" viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></symbol>
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
  <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></symbol>
  <symbol id="i-volup" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/></symbol>
  <symbol id="i-voldown" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9a4 4 0 0 1 0 6"/></symbol>
  <symbol id="i-mute" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M6 4l10 8-10 8z"/><path d="M18 5v14"/></symbol>
  <symbol id="i-rew" viewBox="0 0 24 24"><path d="M11 6l-7 6 7 6zM20 6l-7 6 7 6z"/></symbol>
  <symbol id="i-ff" viewBox="0 0 24 24"><path d="M13 6l7 6-7 6zM4 6l7 6-7 6z"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></symbol>
  <symbol id="i-kbd" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></symbol>
  <symbol id="i-camera" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></symbol>
  <symbol id="i-live" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/></symbol>
  <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></symbol>
  <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></symbol>
  <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></symbol>
  <symbol id="i-send" viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-3-7z"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
  <symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/></symbol>
  <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></symbol>
  <symbol id="i-more" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></symbol>
  <symbol id="i-broom" viewBox="0 0 24 24"><path d="M14 4l6 6M17 7l-6.5 6.5"/><path d="M10.5 13.5L4 20h7l2.5-4.5z"/></symbol>
  <symbol id="i-stop" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></symbol>
  <symbol id="i-unplug" viewBox="0 0 24 24"><path d="M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0zM12 17v4"/></symbol>
</svg>

<header class="top" id="siteHeader">
  <a class="brand" href="./"><svg class="ico"><use href="#i-tv"/></svg><span>TV box</span></a>
  <span class="top-model mono" id="topModel">Xiaomi · <?= $h(TV_HOST) ?></span>
  <nav class="top-nav" aria-label="Secciones" id="topNav" hidden>
    <a href="#mando">Mando</a>
    <a href="#apps">Apps</a>
    <a href="#enviar">Enviar</a>
    <a href="#ajustes">Ajustes</a>
    <a href="#sistema">Sistema</a>
  </nav>
  <div class="top-tools">
    <span class="chip" id="liveChip"><i class="dot"></i><span>Comprobando…</span></span>
    <button class="icon-btn" id="btnRefresh" type="button" data-tip="Volver a leer la tele"><svg class="ico"><use href="#i-refresh"/></svg><span class="sr">Actualizar</span></button>
    <button class="icon-btn" id="btnTheme" type="button" data-tip="Tema claro u oscuro"><svg class="ico"><use href="#i-moon"/></svg><span class="sr">Cambiar tema</span></button>
  </div>
</header>

<main>
  <!-- Sin conexión: los pasos para activar ADB en la tele -->
  <section class="hero onboard" id="onboard" hidden>
    <div class="onboard-copy">
      <p class="eyebrow mono" id="obEyebrow">Sin conexión</p>
      <h1 class="status-title" id="obTitle">Falta un paso en la tele</h1>
      <p class="status-lead" id="obLead">Para que el PC pueda manejarla hay que activar la depuración en la TV box una sola vez.</p>
      <div class="hero-actions">
        <button class="btn" type="button" id="btnConnect"><svg class="ico"><use href="#i-link"/></svg>Conectar ahora</button>
        <span class="form-msg" id="connectMsg" role="status"></span>
      </div>
      <p class="diag mono" id="diag"></p>
    </div>
    <ol class="steps">
      <li><b>Ajustes → Preferencias del dispositivo → Información.</b> Baja hasta <em>Compilación</em> y pulsa OK siete veces, hasta que diga que ya eres desarrollador.</li>
      <li><b>Vuelve a Preferencias del dispositivo → Opciones para desarrolladores.</b> Activa <em>Depuración USB</em> (en esta caja también abre la depuración por red).</li>
      <li><b>Pulsa «Conectar ahora».</b> En la tele aparece «¿Permitir depuración USB?»: marca <em>Permitir siempre desde este ordenador</em> y acepta.</li>
      <li class="steps-alt"><b>¿Tu menú tiene «Depuración inalámbrica»?</b> (Android 11 o posterior). Actívala, entra en <em>Vincular con código</em> y escribe aquí lo que salga:
        <form class="pair" id="pairForm">
          <input type="text" name="destino" placeholder="IP:puerto (p. ej. 192.168.1.50:37215)" autocomplete="off" inputmode="decimal">
          <input type="text" name="codigo" placeholder="Código" maxlength="6" autocomplete="off" inputmode="numeric">
          <button class="btn btn-quiet" type="submit">Vincular</button>
        </form>
        Después pon en <code>.env</code> el puerto de «Dirección IP y puerto» (no el de vincular) como <code>TV_PORT</code>.
      </li>
    </ol>
    <div class="can-do">
      <h2 class="small-title">Cuando conecte podrás</h2>
      <ul>
        <li>Ver la pantalla de la tele en el PC, también en vivo</li>
        <li>Usar el mando desde aquí o con las teclas del ordenador</li>
        <li>Escribir en la tele con el teclado (buscar en YouTube, contraseñas wifi…)</li>
        <li>Mandar enlaces y vídeos de YouTube a la tele</li>
        <li>Abrir, cerrar, desactivar o desinstalar apps e instalar APK</li>
        <li>Hacer que los menús vayan más ágiles y ajustar el salvapantallas y la suspensión</li>
        <li>Ver memoria, almacenamiento, temperatura y wifi, y liberar espacio</li>
      </ul>
    </div>
  </section>

  <!-- Conectada: pantalla + mando -->
  <section class="hero stage" id="mando" hidden>
    <div class="stage-head">
      <p class="eyebrow mono" id="stEyebrow">Conectada</p>
      <h1 class="status-title" id="stTitle">&nbsp;</h1>
      <p class="status-lead" id="stLead">&nbsp;</p>
    </div>

    <div class="screen-wrap">
      <div class="tv" id="tv" tabindex="0" aria-label="Pantalla de la tele. Pulsa para usar el teclado como mando.">
        <div class="tv-screen">
          <img id="shot" alt="Pantalla de la tele" hidden>
          <div class="tv-empty" id="tvEmpty"><svg class="ico ico-xl"><use href="#i-camera"/></svg><span>Pulsa «Captura» para ver la pantalla</span></div>
          <span class="tv-badge" id="liveBadge" hidden><i></i>EN VIVO</span>
        </div>
      </div>
      <div class="tv-bar">
        <button class="btn btn-quiet sm" type="button" id="btnShot"><svg class="ico"><use href="#i-camera"/></svg>Captura</button>
        <button class="btn btn-quiet sm" type="button" id="btnLive" aria-pressed="false"><svg class="ico"><use href="#i-live"/></svg>En vivo</button>
        <a class="btn btn-quiet sm" id="btnSave" download hidden><svg class="ico"><use href="#i-download"/></svg>Guardar</a>
        <span class="kbd-hint muted" id="kbdHint">Pulsa la pantalla o el mando para usar el teclado: flechas, Intro, Retroceso (atrás), Inicio, + y −, espacio.</span>
      </div>
    </div>

    <div class="remote" id="remote" tabindex="-1">
      <div class="r-row r-top">
        <button class="rk" data-key="dormir" data-tip="Apagar pantalla (reposo)"><svg class="ico"><use href="#i-power"/></svg></button>
        <button class="rk" data-key="encender" data-tip="Encender pantalla">ON</button>
        <button class="rk" data-key="ajustes" data-tip="Ajustes"><svg class="ico"><use href="#i-gear"/></svg></button>
      </div>
      <div class="dpad">
        <button class="dp up" data-key="arriba" aria-label="Arriba"><svg class="ico"><use href="#i-up"/></svg></button>
        <button class="dp left" data-key="izquierda" aria-label="Izquierda"><svg class="ico"><use href="#i-left"/></svg></button>
        <button class="dp ok" data-key="ok">OK</button>
        <button class="dp right" data-key="derecha" aria-label="Derecha"><svg class="ico"><use href="#i-right"/></svg></button>
        <button class="dp down" data-key="abajo" aria-label="Abajo"><svg class="ico"><use href="#i-down"/></svg></button>
      </div>
      <div class="r-row">
        <button class="rk" data-key="atras" data-tip="Atrás"><svg class="ico"><use href="#i-back"/></svg></button>
        <button class="rk" data-key="inicio" data-tip="Inicio"><svg class="ico"><use href="#i-home"/></svg></button>
        <button class="rk" data-key="menu" data-tip="Menú"><svg class="ico"><use href="#i-menu"/></svg></button>
      </div>
      <div class="r-row">
        <button class="rk" data-key="vol_menos" data-tip="Bajar volumen"><svg class="ico"><use href="#i-voldown"/></svg></button>
        <button class="rk" data-key="silencio" data-tip="Silenciar"><svg class="ico"><use href="#i-mute"/></svg></button>
        <button class="rk" data-key="vol_mas" data-tip="Subir volumen"><svg class="ico"><use href="#i-volup"/></svg></button>
      </div>
      <div class="vol" id="vol" hidden><span class="vol-bar"><i id="volFill"></i></span><span class="mono" id="volText"></span></div>
      <div class="r-row">
        <button class="rk" data-key="retroceder" data-tip="Retroceder"><svg class="ico"><use href="#i-rew"/></svg></button>
        <button class="rk" data-key="reproducir" data-tip="Reproducir / pausa"><svg class="ico"><use href="#i-play"/></svg></button>
        <button class="rk" data-key="avanzar" data-tip="Avanzar"><svg class="ico"><use href="#i-ff"/></svg></button>
      </div>
      <form class="r-type" id="typeForm">
        <input type="text" id="typeText" placeholder="Escribir en la tele…" autocomplete="off" maxlength="500">
        <button class="rk" type="submit" data-tip="Enviar texto"><svg class="ico"><use href="#i-send"/></svg></button>
      </form>
    </div>
  </section>

  <div id="connected" hidden>
    <section class="sec" id="apps" data-reveal>
      <div class="sec-head">
        <h2 class="split-title">Apps</h2>
        <p>Abre una app en la tele, ciérrala si se ha quedado colgada o quita las que no usas. Las del sistema se pueden desactivar (vuelven con «Activar»), no borrar.</p>
        <div class="sec-actions">
          <label class="btn btn-quiet apk-btn"><input type="file" id="apkFile" accept=".apk"><svg class="ico"><use href="#i-upload"/></svg>Instalar APK</label>
        </div>
      </div>
      <div class="apps-bar">
        <div class="seg" role="tablist" id="appTabs">
          <label><input type="radio" name="apptab" value="user" checked><span>Instaladas <b id="cUser"></b></span></label>
          <label><input type="radio" name="apptab" value="system"><span>Sistema <b id="cSys"></b></span></label>
          <label><input type="radio" name="apptab" value="disabled"><span>Desactivadas <b id="cDis"></b></span></label>
        </div>
        <label class="search"><svg class="ico"><use href="#i-search"/></svg><input type="search" id="appSearch" placeholder="Buscar app" autocomplete="off"></label>
      </div>
      <ul class="apps" id="appList"><li class="muted">Cargando…</li></ul>
    </section>

    <section class="sec" id="enviar" data-reveal>
      <div class="sec-head">
        <h2 class="split-title">Enviar a la tele</h2>
        <p>Un enlace se abre en la tele; si es de YouTube, directamente en la app de YouTube.</p>
      </div>
      <form class="panel send" id="urlForm">
        <svg class="ico ico-lg"><use href="#i-link"/></svg>
        <input type="text" id="urlText" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off">
        <button class="btn" type="submit"><svg class="ico"><use href="#i-send"/></svg>Abrir en la tele</button>
      </form>
    </section>

    <section class="sec" id="ajustes" data-reveal>
      <div class="sec-head">
        <h2 class="split-title">Ajustes</h2>
        <p>Los cambios se aplican al momento en la tele y se pueden deshacer igual.</p>
      </div>
      <div class="settings" id="settings">
        <div class="panel setting" data-setting="animaciones">
          <div><h3>Velocidad de los menús</h3><p class="muted">Las animaciones más cortas hacen que la caja parezca bastante más rápida; «Sin» es lo más ágil.</p></div>
          <div class="seg"><label><input type="radio" name="animaciones" value="1"><span>Normal</span></label><label><input type="radio" name="animaciones" value="0.5"><span>Rápida</span></label><label><input type="radio" name="animaciones" value="0"><span>Sin animaciones</span></label></div>
        </div>
        <div class="panel setting" data-setting="salvapantallas">
          <div><h3>Salvapantallas tras</h3><p class="muted">Cuándo sale el salvapantallas si no tocas el mando.</p></div>
          <div class="seg"><label><input type="radio" name="salvapantallas" value="300000"><span>5 min</span></label><label><input type="radio" name="salvapantallas" value="900000"><span>15 min</span></label><label><input type="radio" name="salvapantallas" value="1800000"><span>30 min</span></label><label><input type="radio" name="salvapantallas" value="3600000"><span>1 h</span></label><label><input type="radio" name="salvapantallas" value="2147483647"><span>Nunca</span></label></div>
        </div>
        <div class="panel setting" data-setting="suspension">
          <div><h3>Suspender tras</h3><p class="muted">Cuándo se apaga la caja sola. En suspensión el panel no puede conectar hasta que la enciendas con el mando.</p></div>
          <div class="seg"><label><input type="radio" name="suspension" value="1800000"><span>30 min</span></label><label><input type="radio" name="suspension" value="3600000"><span>1 h</span></label><label><input type="radio" name="suspension" value="14400000"><span>4 h</span></label><label><input type="radio" name="suspension" value="28800000"><span>8 h</span></label><label><input type="radio" name="suspension" value="-1"><span>Nunca</span></label></div>
        </div>
      </div>
    </section>

    <section class="sec" id="sistema" data-reveal>
      <div class="sec-head">
        <h2 class="split-title">Sistema</h2>
        <p>La caja por dentro, y lo que se puede hacer para que vaya mejor.</p>
        <div class="sec-actions">
          <button class="btn btn-quiet" type="button" data-sys="liberar_cache"><svg class="ico"><use href="#i-broom"/></svg>Liberar caché</button>
          <button class="btn btn-quiet" type="button" data-sys="cerrar_fondo"><svg class="ico"><use href="#i-stop"/></svg>Cerrar apps en segundo plano</button>
          <button class="btn btn-quiet" type="button" data-sys="ajustes"><svg class="ico"><use href="#i-gear"/></svg>Ajustes en la tele</button>
          <button class="btn btn-quiet danger" type="button" data-sys="reiniciar"><svg class="ico"><use href="#i-power"/></svg>Reiniciar</button>
        </div>
      </div>
      <div class="meters" id="meters"></div>
      <div class="grid-3" id="specs"></div>
      <h3 class="sub-title">Mejoras</h3>
      <ol class="checks" id="checks"></ol>
      <p class="disconnect"><button class="link-btn" type="button" id="btnDisconnect"><svg class="ico"><use href="#i-unplug"/></svg>Desconectar este PC de la tele</button></p>
    </section>
  </div>
</main>

<footer class="foot muted small">Panel local · solo responde a este PC · habla con la tele por ADB en la wifi de casa, sin nube.</footer>

<dialog class="confirm" id="confirm">
  <form method="dialog">
    <h3 id="confirmTitle"></h3>
    <p id="confirmText"></p>
    <div class="confirm-actions">
      <button class="btn btn-quiet" value="no">Cancelar</button>
      <button class="btn" value="si" id="confirmOk">Seguir</button>
    </div>
  </form>
</dialog>
<div class="toasts" id="toasts" aria-live="polite"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/SplitText.min.js"></script>
<script src="js/scroll.js?v=<?= $v('js/scroll.js') ?>"></script>
<script src="js/tvbox.js?v=<?= $v('js/tvbox.js') ?>"></script>
</body>
</html>
