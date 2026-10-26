<?php
declare(strict_types=1);

/*
 * ADB por red contra la TV box. Todas las órdenes salen de aquí y de listas blancas: el panel
 * nunca manda a la tele un comando escrito por el usuario. Lo que viene del usuario (texto,
 * URL, nombre de paquete) se valida y se escapa para el shell de Android.
 *
 * El servidor adb (puerto 5037) lo arranca el primer adb que se ejecute y lo comparten Apache y
 * la consola (los dos corren con el usuario de Windows). La clave del PC está en
 * %USERPROFILE%\.android\adbkey: la tele la autoriza una vez con «Permitir siempre».
 */

function adb_serial(): string
{
    return TV_HOST . ':' . TV_PORT;
}

/** Ejecuta adb con argumentos sueltos (sin pasar por cmd.exe). Devuelve [código, stdout, stderr]. */
function adb_run(array $args, int $timeout = 15): array
{
    $cmd = array_merge([ADB_PATH], array_map('strval', $args));    $proc = proc_open($cmd, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, null, ['bypass_shell' => true]);
    if (!is_resource($proc)) {
        throw new RuntimeException('No se pudo lanzar adb (revisa ADB_PATH en .env)');
    }
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);
    $out = '';
    $err = '';
    $end = microtime(true) + $timeout;
    while (true) {
        $out .= (string)stream_get_contents($pipes[1]);
        $err .= (string)stream_get_contents($pipes[2]);
        $st = proc_get_status($proc);
        if (!$st['running']) {
            $code = (int)$st['exitcode'];
            break;
        }
        if (microtime(true) > $end) {
            proc_terminate($proc);
            fclose($pipes[1]);
            fclose($pipes[2]);
            proc_close($proc);
            throw new RuntimeException('La tele tardó demasiado en contestar');
        }
        usleep(20000);
    }
    $out .= (string)stream_get_contents($pipes[1]);
    $err .= (string)stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    proc_close($proc);
    return [$code, $out, $err];
}

/** Estado de la conexión: device | unauthorized | offline | none. */
function adb_state(): string
{
    [, $out] = adb_run(['devices'], 10);
    foreach (preg_split('/\R/', $out) as $line) {
        if (preg_match('/^(\S+)\s+(device|unauthorized|offline|authorizing|connecting)\b/', trim($line), $m) && $m[1] === adb_serial()) {
            return $m[2] === 'device' ? 'device' : ($m[2] === 'unauthorized' || $m[2] === 'authorizing' ? 'unauthorized' : 'offline');
        }
    }
    return 'none';
}

/** Conecta (o reconecta). Devuelve el estado resultante y el mensaje de adb. */
function adb_connect(): array
{
    [, $out, $err] = adb_run(['connect', adb_serial()], 12);
    $msg = trim($out . ' ' . $err);
    usleep(400000);
    return [adb_state(), $msg];
}

function adb_disconnect(): void
{
    adb_run(['disconnect', adb_serial()], 8);
}

/** Emparejar con «Depuración inalámbrica» (Android 11+): IP:puerto y código de 6 cifras de la tele. */
function adb_pair(string $hostPort, string $code): string
{
    if (!preg_match('/^\d{1,3}(\.\d{1,3}){3}:\d{2,5}$/', $hostPort) || !preg_match('/^\d{6}$/', $code)) {
        throw new RuntimeException('Escribe la IP:puerto y el código de 6 cifras tal como salen en la tele');
    }
    [, $out, $err] = adb_run(['pair', $hostPort, $code], 20);
    return trim($out . ' ' . $err);
}

/** Ejecuta un comando de shell en la tele. $cmd se construye SIEMPRE desde este archivo. */
function adb_shell(string $cmd, int $timeout = 15): string
{
    [$code, $out, $err] = adb_run(['-s', adb_serial(), 'shell', $cmd], $timeout);
    if ($code !== 0 && trim($out) === '') {
        $e = trim($err);
        if (str_contains($e, 'not found') || str_contains($e, 'offline') || str_contains($e, 'unauthorized')) {
            throw new RuntimeException('La tele no está conectada');
        }
        throw new RuntimeException($e !== '' ? $e : 'La tele no respondió');
    }
    return str_replace("\r\n", "\n", $out);
}

/** Comillas simples para el shell de Android. */
function sh_quote(string $s): string
{
    return "'" . str_replace("'", "'\\''", $s) . "'";
}

function valid_package(string $p): bool
{
    return (bool)preg_match('/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/', $p) && strlen($p) <= 200;
}

/* ── Información ────────────────────────────────────────────── */

/** Todo lo del panel en UNA llamada al shell (cada llamada cuesta ~150 ms). */
function tv_info(): array
{
    $parts = [
        'manufacturer' => 'getprop ro.product.manufacturer',
        'model' => 'getprop ro.product.model',
        'device' => 'getprop ro.product.device',
        'android' => 'getprop ro.build.version.release',
        'sdk' => 'getprop ro.build.version.sdk',
        'build' => 'getprop ro.build.display.id',
        'patch' => 'getprop ro.build.version.security_patch',
        'name' => 'settings get global device_name',
        'uptime' => 'cat /proc/uptime',
        'mem' => 'grep -E "^(MemTotal|MemAvailable):" /proc/meminfo',
        'disk' => 'df -k /data | tail -n 1',
        'temp' => 'cat /sys/class/thermal/thermal_zone0/temp',
        'power' => 'dumpsys power | grep -E "mWakefulness=|Display Power: state="',
        'focus' => 'dumpsys window | grep -E "mCurrentFocus=|mFocusedApp=" | head -n 2',
        'wifi' => 'dumpsys wifi | grep -m 1 -E "mWifiInfo|WifiInfo:"',
        'ip' => 'ip -4 addr show wlan0 | grep inet',
        'eth' => 'ip -4 addr show eth0 | grep inet',
        'size' => 'wm size',
        'density' => 'wm density',
        // Android 10+ trae `cmd media_session`; en el 9 (Mi Box 4) solo existe `media`.
        'volume' => 'cmd media_session volume --stream 3 --get 2>/dev/null; media volume --stream 3 --get 2>/dev/null',
        'anim' => 'settings get global window_animation_scale; settings get global transition_animation_scale; settings get global animator_duration_scale',
    ];
    $script = '';
    foreach ($parts as $k => $c) {
        $script .= "echo '@@$k'; ($c) 2>/dev/null; ";
    }
    $out = adb_shell($script, 20);

    $sec = [];
    $cur = null;
    foreach (explode("\n", $out) as $line) {
        if (str_starts_with($line, '@@')) {
            $cur = substr($line, 2);
            $sec[$cur] = [];
            continue;
        }
        if ($cur !== null && trim($line) !== '') {
            $sec[$cur][] = trim($line);
        }
    }
    $one = fn(string $k): string => $sec[$k][0] ?? '';

    $mem = [];
    foreach ($sec['mem'] ?? [] as $l) {
        if (preg_match('/^(\w+):\s+(\d+)/', $l, $m)) {
            $mem[$m[1]] = (int)$m[2] * 1024;
        }
    }
    $disk = preg_split('/\s+/', $one('disk'));
    $power = implode(' ', $sec['power'] ?? []);
    $focus = implode(' ', $sec['focus'] ?? []);
    $app = preg_match('/\b([a-zA-Z][\w.]+)\/[\w.$]+/', $focus, $fm) ? $fm[1] : '';
    $wifi = implode(' ', $sec['wifi'] ?? []);
    $temp = (int)$one('temp');
    $anim = $sec['anim'] ?? [];
    $vol = implode(' ', $sec['volume'] ?? []);

    return [
        'fabricante' => $one('manufacturer'),
        'modelo' => $one('model'),
        'dispositivo' => $one('device'),
        'android' => $one('android'),
        'sdk' => (int)$one('sdk'),
        'compilacion' => $one('build'),
        'parche' => $one('patch'),
        'nombre' => $one('name') !== 'null' ? $one('name') : '',
        'encendida_s' => (int)(float)explode(' ', $one('uptime'))[0],
        'ram_total' => $mem['MemTotal'] ?? null,
        'ram_libre' => $mem['MemAvailable'] ?? null,
        'disco_total' => isset($disk[1]) && ctype_digit($disk[1]) ? (int)$disk[1] * 1024 : null,
        'disco_libre' => isset($disk[3]) && ctype_digit($disk[3]) ? (int)$disk[3] * 1024 : null,
        'temperatura' => $temp > 1000 ? round($temp / 1000, 1) : ($temp > 0 ? $temp : null),
        'pantalla' => preg_match('/mWakefulness=(\w+)/', $power, $pm) ? strtolower($pm[1]) : '',
        'app' => $app,
        'wifi_rssi' => preg_match('/RSSI:\s*(-?\d+)/', $wifi, $wm) ? (int)$wm[1] : null,
        'wifi_ssid' => preg_match('/SSID:\s*"?([^",]+)"?,/', $wifi, $sm) ? $sm[1] : null,
        'wifi_mbps' => preg_match('/Link speed:\s*(\d+)/', $wifi, $lm) ? (int)$lm[1] : null,
        'wifi_ghz' => preg_match('/Frequency:\s*(\d+)/', $wifi, $fq) ? round((int)$fq[1] / 1000, 1) : null,
        'ip' => preg_match('/inet ([\d.]+)/', implode(' ', $sec['ip'] ?? []), $im) ? $im[1] : TV_HOST,
        'cable' => preg_match('/inet ([\d.]+)/', implode(' ', $sec['eth'] ?? []), $em) ? $em[1] : null,
        'resolucion' => preg_match('/(\d+x\d+)\s*$/', implode(' ', $sec['size'] ?? []), $rm) ? $rm[1] : '',
        'densidad' => preg_match('/(\d+)\s*$/', implode(' ', $sec['density'] ?? []), $dm) ? (int)$dm[1] : null,
        'volumen' => preg_match('/volume is (\d+) in range \[(\d+)\.\.(\d+)\]/', $vol, $vm) ? ['nivel' => (int)$vm[1], 'max' => (int)$vm[3]] : null,
        'animaciones' => array_map(fn($v) => $v === 'null' || $v === '' ? 1.0 : (float)$v, array_slice($anim + ['1', '1', '1'], 0, 3)),
    ];
}

/* ── Mando ──────────────────────────────────────────────────── */

const TV_KEYS = [
    'arriba' => 19, 'abajo' => 20, 'izquierda' => 21, 'derecha' => 22, 'ok' => 23,
    'atras' => 4, 'inicio' => 3, 'menu' => 82, 'ajustes' => 176, 'recientes' => 187, 'buscar' => 84,
    'vol_mas' => 24, 'vol_menos' => 25, 'silencio' => 164,
    'reproducir' => 85, 'siguiente' => 87, 'anterior' => 88, 'retroceder' => 89, 'avanzar' => 90,
    'encender' => 224, 'dormir' => 223, 'power' => 26,
    'borrar' => 67, 'intro' => 66, 'entrada' => 178,
];

function tv_key(string $name, bool $long = false): void
{
    if (!isset(TV_KEYS[$name])) {
        throw new RuntimeException('Tecla desconocida');
    }
    adb_shell('input keyevent ' . ($long ? '--longpress ' : '') . TV_KEYS[$name], 8);
}

/** Escribe texto en el campo que tenga el foco en la tele. */
function tv_text(string $text): void
{
    // input text solo admite ASCII: las tildes se quitan («canción» → «cancion»).
    // (iconv //TRANSLIT de Windows deja «tú» como «t'u»: por eso la tabla propia).
    $text = mb_substr(str_replace(["\r", "\n", "\t"], ' ', $text), 0, 500);
    $text = strtr($text, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N', 'ç' => 'c', 'Ç' => 'C',
        'à' => 'a', 'è' => 'e', 'ò' => 'o', 'ï' => 'i', '¿' => '', '¡' => '', '€' => 'EUR', '“' => '"', '”' => '"', '‘' => "'", '’' => "'"]);
    // Espacio = %s; el resto de símbolos se escapan con \ para el shell de Android.
    $esc = '';
    foreach (str_split($text) as $ch) {
        $o = ord($ch);
        if ($o < 32 || $o > 126) {
            continue;
        }
        $esc .= $ch === ' ' ? '%s' : (ctype_alnum($ch) ? $ch : '\\' . $ch);
    }
    if ($esc === '') {
        return;
    }
    adb_shell('input text ' . $esc, 10);
}

/** Captura de pantalla en PNG. */
function tv_screenshot(): string
{
    [$code, $out, $err] = adb_run(['-s', adb_serial(), 'exec-out', 'screencap', '-p'], 15);
    if ($code !== 0 || !str_starts_with($out, "\x89PNG")) {
        throw new RuntimeException(trim($err) !== '' ? trim($err) : 'No se pudo capturar la pantalla');
    }
    return $out;
}

/* ── Apps ───────────────────────────────────────────────────── */

function tv_packages(): array
{
    $out = adb_shell("echo '@@user'; pm list packages -3; echo '@@disabled'; pm list packages -d; echo '@@all'; pm list packages -s", 20);
    $sec = ['user' => [], 'disabled' => [], 'all' => []];
    $cur = null;
    foreach (explode("\n", $out) as $line) {
        $line = trim($line);
        if (str_starts_with($line, '@@')) {
            $cur = substr($line, 2);
            continue;
        }
        if ($cur && str_starts_with($line, 'package:')) {
            $sec[$cur][] = substr($line, 8);
        }
    }
    $disabled = array_flip($sec['disabled']);
    $list = [];
    foreach ($sec['user'] as $p) {
        $list[$p] = ['paquete' => $p, 'sistema' => false, 'desactivada' => isset($disabled[$p])];
    }
    foreach ($sec['all'] as $p) {
        $list[$p] ??= ['paquete' => $p, 'sistema' => true, 'desactivada' => isset($disabled[$p])];
    }
    ksort($list);
    return array_values($list);
}

function tv_app_action(string $action, string $pkg): string
{
    if (!valid_package($pkg)) {
        throw new RuntimeException('Nombre de app no válido');
    }
    $q = sh_quote($pkg);
    return match ($action) {
        // Primero el lanzador de Android TV; si la app no tiene, el normal.
        'abrir' => adb_shell("monkey -p $q -c android.intent.category.LEANBACK_LAUNCHER 1 2>&1 | grep -q 'No activities' && monkey -p $q -c android.intent.category.LAUNCHER 1; true", 15),
        'cerrar' => adb_shell("am force-stop $q", 10),
        'desactivar' => adb_shell("pm disable-user --user 0 $q", 15),
        'activar' => adb_shell("pm enable $q", 15),
        'desinstalar' => adb_shell("pm uninstall $q", 30),
        default => throw new RuntimeException('Acción desconocida'),
    };
}

/** Instala un APK subido. */
function tv_install(string $apkPath): string
{
    [$code, $out, $err] = adb_run(['-s', adb_serial(), 'install', '-r', $apkPath], 240);
    $msg = trim($out . ' ' . $err);
    if ($code !== 0 || !str_contains($msg, 'Success')) {
        throw new RuntimeException(preg_match('/(INSTALL_[A-Z_]+[^\]]*)/', $msg, $m) ? 'La tele rechazó el APK: ' . $m[1] : ($msg ?: 'No se pudo instalar'));
    }
    return $msg;
}

/* ── Ajustes ────────────────────────────────────────────────── */

/** Ajustes que el panel puede leer y cambiar: [espacio, clave, valores admitidos]. */
const TV_SETTINGS = [
    'animaciones' => ['global', ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale'], ['0', '0.5', '1']],
    'salvapantallas' => ['system', ['screen_off_timeout'], ['60000', '300000', '900000', '1800000', '3600000', '2147483647']],
    'suspension' => ['secure', ['sleep_timeout'], ['900000', '1800000', '3600000', '14400000', '28800000', '-1']],
];

function tv_settings_get(): array
{
    $script = '';
    foreach (TV_SETTINGS as $name => [$ns, $keys]) {
        $script .= "echo '@@$name'; settings get $ns {$keys[0]}; ";
    }
    $out = adb_shell($script, 10);
    $res = [];
    $cur = null;
    foreach (explode("\n", $out) as $l) {
        $l = trim($l);
        if (str_starts_with($l, '@@')) {
            $cur = substr($l, 2);
            continue;
        }
        if ($cur !== null && $l !== '') {
            $res[$cur] = $l;
        }
    }
    return $res;
}

function tv_settings_put(string $name, string $value): void
{
    if (!isset(TV_SETTINGS[$name]) || !in_array($value, TV_SETTINGS[$name][2], true)) {
        throw new RuntimeException('Ajuste no permitido');
    }
    [$ns, $keys] = TV_SETTINGS[$name];
    $cmd = '';
    foreach ($keys as $k) {
        $cmd .= "settings put $ns $k $value; ";
    }
    adb_shell($cmd, 10);
}

/* ── Sistema ────────────────────────────────────────────────── */

function tv_open_url(string $url): void
{
    $url = trim($url);
    // Enlaces de YouTube: se abren en la app de YouTube de la tele.
    if (preg_match('~^(?:https?://)?(?:www\.|m\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([\w-]{6,})~', $url, $m)) {
        adb_shell('am start -a android.intent.action.VIEW -d ' . sh_quote('https://www.youtube.com/watch?v=' . $m[1]), 10);
        return;
    }
    if (!preg_match('~^https?://[^\s]+$~i', $url) || strlen($url) > 2000) {
        throw new RuntimeException('Pon un enlace que empiece por http:// o https://');
    }
    adb_shell('am start -a android.intent.action.VIEW -d ' . sh_quote($url), 10);
}

function tv_system(string $action): string
{
    return match ($action) {
        'liberar_cache' => adb_shell('pm trim-caches 999G; echo ok', 60),
        'cerrar_fondo' => adb_shell('am kill-all; echo ok', 15),
        'ajustes' => adb_shell('am start -a android.settings.SETTINGS', 10),
        // La conexión se corta al reiniciar: no se espera respuesta.
        'reiniciar' => implode(' ', array_slice(adb_run(['-s', adb_serial(), 'reboot'], 10), 1)),
        default => throw new RuntimeException('Acción desconocida'),
    };
}
