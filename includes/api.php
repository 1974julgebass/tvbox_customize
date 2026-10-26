<?php
declare(strict_types=1);

require_once __DIR__ . '/boot.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// La sesión solo guarda el token CSRF: se suelta enseguida para que una petición lenta
// (PowerShell, un escaneo) no bloquee a las demás.
csrf_token();
session_write_close();

function json_out(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Las peticiones que cambian algo llevan el token CSRF en la cabecera X-CSRF-Token.
function require_post_csrf(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_out(['error' => 'Método no permitido'], 405);
    }
    $token = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($token === '' || !hash_equals(csrf_token(), $token)) {
        json_out(['error' => 'La página ha caducado. Recárgala.'], 419);
    }
}

function post_json(): array
{
    $data = json_decode((string)file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}
