<?php
declare(strict_types=1);

// POST {tecla: nombre de TV_KEYS, largo?: bool} | {texto: "..."}
require_once __DIR__ . '/../includes/api.php';
require_once __DIR__ . '/../includes/adb.php';

require_post_csrf();
$in = post_json();

try {
    if (isset($in['texto'])) {
        tv_text((string)$in['texto']);
    } else {
        tv_key((string)($in['tecla'] ?? ''), !empty($in['largo']));
    }
} catch (RuntimeException $e) {
    json_out(['error' => $e->getMessage()], 502);
}
json_out(['ok' => true]);
