<?php
declare(strict_types=1);

// GET: ajustes que maneja el panel. POST {ajuste, valor} con valores de una lista cerrada.
require_once __DIR__ . '/../includes/api.php';
require_once __DIR__ . '/../includes/adb.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        require_post_csrf();
        $in = post_json();
        tv_settings_put((string)($in['ajuste'] ?? ''), (string)($in['valor'] ?? ''));
    }
    json_out(['ajustes' => tv_settings_get()]);
} catch (RuntimeException $e) {
    json_out(['error' => $e->getMessage()], 502);
}
