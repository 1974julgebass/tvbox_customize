<?php
declare(strict_types=1);

// POST multipart: apk. Lo instala (o actualiza) en la tele con adb install -r.
require_once __DIR__ . '/../includes/api.php';
require_once __DIR__ . '/../includes/adb.php';

require_post_csrf();
set_time_limit(300);

$f = $_FILES['apk'] ?? null;
if (!is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $code = is_array($f) ? (int)$f['error'] : UPLOAD_ERR_NO_FILE;
    json_out(['error' => $code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE
        ? 'El APK pasa del límite de subida de PHP (40 MB).' : 'No ha llegado ningún archivo.'], 400);
}
// Un APK es un ZIP: se comprueba la firma, no solo la extensión.
$fh = fopen($f['tmp_name'], 'rb');
$magic = fread($fh, 4);
fclose($fh);
if (!str_ends_with(strtolower((string)$f['name']), '.apk') || $magic !== "PK\x03\x04") {
    json_out(['error' => 'Eso no es un APK.'], 415);
}

$dst = STORAGE . '/tmp/' . bin2hex(random_bytes(8)) . '.apk';
move_uploaded_file($f['tmp_name'], $dst);
try {
    tv_install($dst);
    $reply = [['ok' => true, 'nombre' => basename((string)$f['name'])], 200];
} catch (RuntimeException $e) {
    $reply = [['error' => $e->getMessage()], 502];
}
@unlink($dst);
json_out(...$reply);
