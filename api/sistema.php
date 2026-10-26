<?php
declare(strict_types=1);

// POST {accion: abrir_url, url} | {accion: liberar_cache|cerrar_fondo|ajustes|reiniciar}
require_once __DIR__ . '/../includes/api.php';
require_once __DIR__ . '/../includes/adb.php';

require_post_csrf();
set_time_limit(90);
$in = post_json();
$accion = (string)($in['accion'] ?? '');

try {
    if ($accion === 'abrir_url') {
        tv_open_url((string)($in['url'] ?? ''));
        json_out(['ok' => true]);
    }
    if ($accion === 'liberar_cache') {
        // Espacio libre antes y después, para decir cuánto se ha ganado.
        $free = fn() => (int)(preg_split('/\s+/', trim(adb_shell('df -k /data | tail -n 1')))[3] ?? 0) * 1024;
        $before = $free();
        tv_system('liberar_cache');
        json_out(['ok' => true, 'liberado' => max(0, $free() - $before)]);
    }
    tv_system($accion);
    json_out(['ok' => true]);
} catch (RuntimeException $e) {
    json_out(['error' => $e->getMessage()], 502);
}
