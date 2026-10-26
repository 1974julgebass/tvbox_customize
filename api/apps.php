<?php
declare(strict_types=1);

// GET: apps instaladas. POST {accion: abrir|cerrar|desactivar|activar|desinstalar, paquete}
require_once __DIR__ . '/../includes/api.php';
require_once __DIR__ . '/../includes/adb.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        require_post_csrf();
        $in = post_json();
        $msg = tv_app_action((string)($in['accion'] ?? ''), (string)($in['paquete'] ?? ''));
        if (preg_match('/(Failure|Exception|Error)[^\n]*/i', $msg, $m)) {
            json_out(['error' => trim($m[0])], 422);
        }
        json_out(['ok' => true, 'mensaje' => trim($msg)]);
    }
    json_out(['apps' => tv_packages()]);
} catch (RuntimeException $e) {
    json_out(['error' => $e->getMessage()], 502);
}
