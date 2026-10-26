<?php
declare(strict_types=1);

/**
 * Carga variables de .env en $_ENV / getenv() si aún no están cargadas.
 * Parser mínimo: sin comentarios ni valores multilínea, suficiente para este proyecto.
 */
function load_env(string $path): void
{
    static $loaded = false;
    if ($loaded || !is_file($path)) {
        return;
    }
    $loaded = true;

    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if ($key === '') {
            continue;
        }
        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
    }
}

load_env(__DIR__ . '/../.env');
