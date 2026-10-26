<?php
declare(strict_types=1);

/*
 * Guía de TV (ahora y próximas horas) de los canales pedidos, sacada de la guía XMLTV pública de
 * EPG_dobleM (github.com/davidmuma/EPG_dobleM). El .gz (~8 MB) se descarga como mucho cada 6 horas
 * y se lee en streaming; la respuesta por lista de canales se guarda 10 minutos.
 * GET ?canales=La 1 HD,La 2,Clan
 */
require_once __DIR__ . '/../includes/api.php';

const GUIA_URL = 'https://raw.githubusercontent.com/davidmuma/EPG_dobleM/master/guiatv.xml.gz';
const GUIA_TTL = 6 * 3600;
const GUIA_HORAS = 12;

$canales = array_values(array_unique(array_filter(array_map('trim', explode(',', (string)($_GET['canales'] ?? ''))))));
if ($canales === [] || count($canales) > 24) {
    json_out(['error' => 'Indica entre 1 y 24 canales.'], 400);
}
foreach ($canales as $c) {
    if (!preg_match('/^[\p{L}\p{N} +#.\-]{1,40}$/u', $c)) {
        json_out(['error' => 'Nombre de canal no válido.'], 400);
    }
}

$dir = STORAGE . '/cache';
if (!is_dir($dir)) {
    mkdir($dir, 0775, true);
}
$gz = $dir . '/guiatv.xml.gz';
$respuesta = $dir . '/guia_' . md5(implode('|', $canales)) . '.json';

if (is_file($respuesta) && time() - filemtime($respuesta) < 600 && (!is_file($gz) || filemtime($respuesta) >= filemtime($gz))) {
    header('X-Guia-Cache: hit');
    echo file_get_contents($respuesta);
    exit;
}

if (!is_file($gz) || time() - filemtime($gz) > GUIA_TTL) {
    $tmp = $gz . '.part';
    $fh = fopen($tmp, 'wb');
    $ch = curl_init(GUIA_URL);
    curl_setopt_array($ch, [CURLOPT_FILE => $fh, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 60, CURLOPT_FAILONERROR => true]);
    $ok = curl_exec($ch);
    curl_close($ch);
    fclose($fh);
    if ($ok && filesize($tmp) > 100000) {
        rename($tmp, $gz);
    } else {
        @unlink($tmp);
        if (!is_file($gz)) {
            json_out(['error' => 'No se ha podido descargar la guía de TV.'], 502);
        }
        // Sin red: sigue con la guía anterior.
    }
}

$quiero = array_flip($canales);
$ahora = time();
$hasta = $ahora + GUIA_HORAS * 3600;
$salida = array_fill_keys($canales, []);
$logos = [];

$r = new XMLReader();
if (!$r->open('compress.zlib://' . $gz)) {
    json_out(['error' => 'La guía de TV descargada está dañada.'], 500);
}
while ($r->read()) {
    if ($r->nodeType !== XMLReader::ELEMENT) {
        continue;
    }
    // Los <channel> van al principio y traen el logo (picons_dobleM, PNG transparente).
    if ($r->name === 'channel') {
        $id = (string)$r->getAttribute('id');
        if (isset($quiero[$id])) {
            $c = new SimpleXMLElement($r->readOuterXml());
            if (isset($c->icon['src'])) {
                $logos[$id] = (string)$c->icon['src'];
            }
        }
        continue;
    }
    if ($r->name !== 'programme') {
        continue;
    }
    $canal = (string)$r->getAttribute('channel');
    if (!isset($quiero[$canal])) {
        continue;
    }
    $ini = DateTimeImmutable::createFromFormat('YmdHis O', (string)$r->getAttribute('start'));
    $fin = DateTimeImmutable::createFromFormat('YmdHis O', (string)$r->getAttribute('stop'));
    if (!$ini || !$fin || $fin->getTimestamp() <= $ahora || $ini->getTimestamp() >= $hasta) {
        continue;
    }
    $p = new SimpleXMLElement($r->readOuterXml());
    $salida[$canal][] = [
        'titulo' => trim((string)$p->title),
        'ini' => $ini->getTimestamp(),
        'fin' => $fin->getTimestamp(),
        'cat' => trim((string)($p->category ?? '')),
    ];
}
$r->close();

foreach ($salida as &$lista) {
    usort($lista, fn($a, $b) => $a['ini'] <=> $b['ini']);
}
unset($lista);

$json = json_encode(['canales' => $salida, 'logos' => (object)$logos, 'actualizada' => filemtime($gz)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
file_put_contents($respuesta, $json, LOCK_EX);
echo $json;
