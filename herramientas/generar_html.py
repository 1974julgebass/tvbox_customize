"""Genera las páginas HTML de los manuales, en español e inglés, a partir de los .md (los .md son la fuente).

Uso, desde la raíz del repositorio:
    pip install markdown
    python herramientas/generar_html.py

Español: README.md → docs/index.html y docs/manuales/*.md → docs/manuales/*.html
Inglés:  README.en.md → docs/en/index.html y docs/en/manuals/*.md → docs/en/manuals/*.html
Cada página lleva un selector de idioma que enlaza con su gemela. La carpeta docs/ es la que publica GitHub Pages.
"""
import html
import os
import re
import struct
import sys
from pathlib import Path

import markdown

RAIZ = Path(__file__).resolve().parent.parent
DOCS = RAIZ / 'docs'

# Por idioma: portada (fuente → salida) y manuales (ruta dentro de docs, nombre corto). El orden empareja las páginas
# de un idioma con las del otro para el selector.
IDIOMAS = {
    'es': {
        'portada': ('README.md', 'index.html'),
        'manuales': [('manuales/01-instalacion.md', 'Instalación'), ('manuales/02-configuracion.md', 'Configuración'),
                     ('manuales/03-uso.md', 'Uso')],
        'nombre': 'Inicio para Android TV', 'marca': ('Inicio', 'para Android TV'),
        'textos': {'indice': 'En esta página', 'anterior': 'Anterior', 'siguiente': 'Siguiente', 'portada': 'Portada',
                   'copiar': 'Copiar', 'copiado': 'Copiado', 'menu': 'Manuales', 'paso': 'Siguiente manual',
                   'idioma': 'Idioma'},
    },
    'en': {
        'portada': ('README.en.md', 'en/index.html'),
        'manuales': [('en/manuals/01-installation.md', 'Installation'), ('en/manuals/02-setup.md', 'Setup'),
                     ('en/manuals/03-usage.md', 'Usage')],
        'nombre': 'Home for Android TV', 'marca': ('Home', 'for Android TV'),
        'textos': {'indice': 'On this page', 'anterior': 'Previous', 'siguiente': 'Next', 'portada': 'Home',
                   'copiar': 'Copy', 'copiado': 'Copied', 'menu': 'Manuals', 'paso': 'Next manual',
                   'idioma': 'Language'},
    },
}


def tam_png(ruta):
    """Ancho y alto de un PNG leyendo su cabecera (para reservar el hueco y que la página no salte)."""
    try:
        with open(ruta, 'rb') as f:
            cab = f.read(24)
        return struct.unpack('>II', cab[16:24])
    except (OSError, struct.error):
        return None


def figuras(cuerpo, carpeta):
    """<p><img></p> pasa a <figure> con su pie (el texto alternativo) y tamaño real."""
    def cambia(m):
        alt, src = html.unescape(m.group('alt')), m.group('src')
        tam = tam_png(carpeta / src)
        medidas = f' width="{tam[0]}" height="{tam[1]}"' if tam else ''
        movil = ' figura-movil' if tam and tam[1] > tam[0] else ''
        return (f'<figure class="figura{movil}"><img src="{src}" alt="{html.escape(alt)}"{medidas} loading="lazy" decoding="async">'
                f'<figcaption>{html.escape(alt)}</figcaption></figure>')
    return re.sub(r'<p><img alt="(?P<alt>[^"]*)" src="(?P<src>[^"]+)" ?/?></p>', cambia, cuerpo)


def bloques(cuerpo):
    """Cada <h2> y lo que le sigue, en su <section>; devuelve el html y la lista (id, título) para el índice."""
    partes = re.split(r'(?=<h2 id=")', cuerpo)
    salida, indice = [partes[0]] if partes[0].strip() else [], []
    for p in partes[1:]:
        m = re.match(r'<h2 id="([^"]+)">(.*?)</h2>', p, re.S)
        indice.append((m.group(1), re.sub('<[^>]+>', '', m.group(2))))
        salida.append(f'<section class="bloque" aria-labelledby="{m.group(1)}">{p}</section>')
    return '\n'.join(salida), indice


def _slug(texto, _sep):
    t = texto.translate(str.maketrans('áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')


def paginas(lang):
    """Lista de (fuente, salida, nombre corto) de un idioma: la portada primero."""
    cfg = IDIOMAS[lang]
    lista = [(cfg['portada'][0], cfg['portada'][1], cfg['nombre'])]
    lista += [(m, m.replace('.md', '.html'), n) for m, n in cfg['manuales']]
    return lista


def rel(desde, hasta):
    """Ruta relativa entre dos páginas de docs/ (para enlaces)."""
    return os.path.relpath(DOCS / hasta, (DOCS / desde).parent).replace(os.sep, '/')


def pagina(lang, i):
    cfg, t = IDIOMAS[lang], IDIOMAS[lang]['textos']
    lista = paginas(lang)
    fuente_rel, salida, corto = lista[i]
    es_portada = i == 0
    origen = RAIZ / fuente_rel if es_portada else DOCS / fuente_rel
    fuente = origen.read_text(encoding='utf-8')
    if es_portada:
        # En la web la portada vive dentro de docs/ (y la inglesa en docs/en/): se ajustan sus rutas.
        fuente = re.sub(r'\]\(docs/' + (r'en/' if lang == 'en' else ''), '](', fuente)
        if lang == 'en':
            fuente = fuente.replace('](docs/', '](../')
        fuente = re.sub(r'^\[?(English|Español)\b.*\n+', '', fuente, flags=re.M)  # el enlace de idioma del README
    conv = markdown.Markdown(extensions=['tables', 'fenced_code', 'toc', 'sane_lists'],
                             extension_configs={'toc': {'slugify': _slug}})
    cuerpo = conv.convert(fuente)
    # Enlaces a otros .md: a sus páginas.
    cuerpo = re.sub(r'href="([^"#:]+)\.md(#[^"]*)?"', lambda m: f'href="{m.group(1)}.html{m.group(2) or ""}"', cuerpo)
    # Enlaces de fuera: en otra pestaña.
    cuerpo = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', cuerpo)
    cuerpo = figuras(cuerpo, (DOCS / salida).parent)
    cuerpo = cuerpo.replace('<table>', '<div class="tabla"><table>').replace('</table>', '</table></div>')
    cuerpo = cuerpo.replace('<pre><code', f'<div class="codigo"><button class="copiar" type="button">{t["copiar"]}</button><pre><code').replace('</code></pre>', '</code></pre></div>')

    # Portada de la página: el título, el primer párrafo y la primera imagen si va justo después.
    m = re.match(r'\s*<h1[^>]*>(.*?)</h1>\s*<p>(.*?)</p>\s*(<figure.*?</figure>)?', cuerpo, re.S)
    titulo, entradilla, figura = m.group(1), m.group(2), m.group(3) or ''
    texto, indice = bloques(cuerpo[m.end():])

    estilo = rel(salida, 'estilo/x')[:-1]  # carpeta estilo/ relativa a esta página
    inicio = rel(salida, lista[0][1])
    nav = ''.join(f'<a href="{rel(salida, s)}"{" aria-current=\"page\"" if s == salida else ""}>{n}</a>'
                  for _, s, n in lista[1:])
    # Selector de idioma: la misma página en el otro idioma.
    idiomas = ''.join(
        f'<a href="{rel(salida, paginas(l)[i][1])}" hreflang="{l}" lang="{l}" data-idioma="{l}"'
        f'{" aria-current=\"true\"" if l == lang else ""}>{l.upper()}</a>' for l in IDIOMAS)
    alternos = ''.join(f'<link rel="alternate" hreflang="{l}" href="{rel(salida, paginas(l)[i][1])}">' for l in IDIOMAS)
    toc = ''.join(f'<li><a href="#{a}">{html.escape(b)}</a></li>' for a, b in indice)
    prev = lista[i - 1] if i > 1 else None
    sig = lista[i + 1] if i + 1 < len(lista) else None
    pie_nav = ''
    if prev or sig:
        pie_nav = f'<nav class="paso" aria-label="{t["paso"]}">' + \
            (f'<a class="paso-ant" href="{rel(salida, prev[1])}"><small>{t["anterior"]}</small>{prev[2]}</a>' if prev else '<span></span>') + \
            (f'<a class="paso-sig" href="{rel(salida, sig[1])}"><small>{t["siguiente"]}</small>{sig[2]}</a>' if sig else '') + '</nav>'
    descripcion = re.sub('<[^>]+>', '', entradilla)
    titulo_web = html.escape(re.sub('<[^>]+>', '', titulo)) if es_portada else f'{corto} · {cfg["nombre"]}'
    return f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo_web}</title>
<meta name="description" content="{html.escape(descripcion[:160])}">
{alternos}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&display=swap">
<link rel="stylesheet" href="{estilo}manual.css">
</head>
<body class="{'es-portada' if es_portada else 'es-manual'}" data-copiado="{t['copiado']}" data-copiar="{t['copiar']}">
<header class="cabecera" id="cabecera">
  <a class="marca" href="{inicio}">{cfg['marca'][0]} <span>{cfg['marca'][1]}</span></a>
  <div class="cabecera-der">
    <nav class="menu" aria-label="{t['menu']}">{nav}</nav>
    <nav class="idioma" aria-label="{t['idioma']}">{idiomas}</nav>
  </div>
</header>
<main>
  <section class="portada">
    <h1 class="titular">{titulo}</h1>
    <p class="entradilla">{entradilla}</p>
    {figura.replace('class="figura', 'class="figura figura-portada', 1) if figura else ''}
  </section>
  <div class="cuerpo">
    {f'<aside class="indice" aria-label="{t["indice"]}"><p>{t["indice"]}</p><ol>{toc}</ol></aside>' if toc and not es_portada else ''}
    <article class="texto">
{texto}
    </article>
  </div>
  {pie_nav}
</main>
<footer class="pie"><p>{cfg['nombre']} · <a href="{inicio}">{t['portada']}</a> · <a href="https://github.com/1974julgebass/tvbox_customize" target="_blank" rel="noopener">GitHub</a></p></footer>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/SplitText.min.js"></script>
<script src="{estilo}manual.js"></script>
</body>
</html>
'''


def main():
    hechas = []
    for lang in IDIOMAS:
        for i, (_, salida, _) in enumerate(paginas(lang)):
            destino = DOCS / salida
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_text(pagina(lang, i), encoding='utf-8', newline='\n')
            hechas.append('docs/' + salida)
    print('Generadas:', ', '.join(hechas))


if __name__ == '__main__':
    sys.exit(main())
