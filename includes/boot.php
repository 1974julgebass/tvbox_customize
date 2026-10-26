<?php
declare(strict_types=1);

/*
 * Arranque común de páginas y API. El panel no tiene login: solo responde a este PC
 * (Require local en .htaccess, y aquí otra vez por si el .htaccess deja de aplicarse).
 * La sesión existe solo para el token CSRF de las acciones.
 */
require_once __DIR__ . '/env.php';
require_once __DIR__ . '/csrf.php';

$remote = (string)($_SERVER['REMOTE_ADDR'] ?? '');
// Igual que `Require local`: loopback o la propia IP del PC (si se abre por su IP o su nombre).
if (!in_array($remote, ['127.0.0.1', '::1', (string)($_SERVER['SERVER_ADDR'] ?? '')], true) || $remote === '') {
    http_response_code(403);
    exit('Solo desde este PC.');
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('tvbox');
    // La cookie vale para la carpeta del panel, esté donde esté dentro de htdocs.
    $base = rtrim(str_replace(DIRECTORY_SEPARATOR, '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/'))), '/');
    $base = preg_replace('#/api$#', '', $base) . '/';
    session_set_cookie_params(['path' => $base, 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
}

define('TV_HOST', (string)(getenv('TV_HOST') ?: '192.168.1.50'));
define('TV_PORT', (int)(getenv('TV_PORT') ?: 5555));
define('ADB_PATH', (string)(getenv('ADB_PATH') ?: 'adb'));
define('STORAGE', dirname(__DIR__) . '/storage');
