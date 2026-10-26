<?php
declare(strict_types=1);

// POST {accion: conectar|desconectar|emparejar, destino?: "IP:puerto", codigo?: "123456"}
require_once __DIR__ . '/../includes/api.php';
require_once __DIR__ . '/../includes/adb.php';

require_post_csrf();
$in = post_json();

try {
    switch ((string)($in['accion'] ?? '')) {
        case 'conectar':
            [$estado, $msg] = adb_connect();
            json_out(['estado' => $estado, 'mensaje' => $msg]);
        case 'desconectar':
            adb_disconnect();
            json_out(['estado' => 'none']);
        case 'emparejar':
            $msg = adb_pair((string)($in['destino'] ?? ''), (string)($in['codigo'] ?? ''));
            if (!str_contains(strtolower($msg), 'successfully')) {
                json_out(['error' => 'No se pudo emparejar: ' . $msg], 400);
            }
            [$estado, $cmsg] = adb_connect();
            json_out(['estado' => $estado, 'mensaje' => $msg . ' ' . $cmsg]);
        default:
            json_out(['error' => 'Acción desconocida'], 400);
    }
} catch (RuntimeException $e) {
    json_out(['error' => $e->getMessage()], 502);
}
