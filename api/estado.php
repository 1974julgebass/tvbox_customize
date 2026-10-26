<?php
declare(strict_types=1);

/*
 * Estado de la conexión y, si está conectada, la ficha de la tele. No conecta por su cuenta:
 * eso lo pide el panel con api/conectar.php (un intento fallido tarda ~10 s).
 */
require_once __DIR__ . '/../includes/api.php';
require_once __DIR__ . '/../includes/adb.php';

if (!is_file(ADB_PATH)) {
    json_out(['adb' => false, 'estado' => 'none', 'host' => TV_HOST, 'puerto' => TV_PORT]);
}

$estado = adb_state();
$out = ['adb' => true, 'estado' => $estado, 'host' => TV_HOST, 'puerto' => TV_PORT, 'ts' => time()];

if ($estado !== 'device') {
    // ¿La caja está en la red con el puerto abierto (depuración activada) o no?
    $fp = @fsockopen(TV_HOST, TV_PORT, $errno, $errstr, 1.5);
    $out['puerto_abierto'] = (bool)$fp;
    if ($fp) {
        fclose($fp);
    }
    json_out($out);
}

try {
    $out['info'] = tv_info();
} catch (RuntimeException $e) {
    $out['estado'] = 'offline';
    $out['error'] = $e->getMessage();
}
json_out($out);
