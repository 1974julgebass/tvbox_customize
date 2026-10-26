<?php
declare(strict_types=1);

// GET: captura de pantalla de la tele en PNG.
require_once __DIR__ . '/../includes/api.php';
require_once __DIR__ . '/../includes/adb.php';

try {
    $png = tv_screenshot();
} catch (RuntimeException $e) {
    json_out(['error' => $e->getMessage()], 502);
}
header_remove('Content-Type');
header('Content-Type: image/png');
header('Content-Length: ' . strlen($png));
echo $png;
