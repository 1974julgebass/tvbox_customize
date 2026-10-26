"""Genera las páginas HTML de los manuales a partir de los .md (los .md siguen siendo la fuente).

Uso, desde la raíz del repositorio:
    pip install markdown
    python herramientas/generar_html.py

Crea docs/index.html (desde README.md) y docs/manuales/*.html (desde docs/manuales/*.md), con el estilo y el script
de docs/estilo/. La carpeta docs/ es la que publica GitHub Pages.
"""
import html
import re
import struct
import sys
from pathlib import Path

import markdown

RAIZ = Path(__file__).resolve().parent.parent
DOCS = RAIZ / 'docs'
MANUALES = [
    ('manuales/01-instalacion.md', 'Instalación'),
    ('manuales/02-configuracion.md', 'Configuración'),
    ('manuales/03-uso.md', 'Uso'),
]
NOMBRE = 'Inicio para Android TV'


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


def pagina(md_ruta, titulo_corto, prev, sig):
    origen = RAIZ / md_ruta if md_ruta == 'README.md' else DOCS / md_ruta
    fuente = origen.read_text(encoding='utf-8')
    if md_ruta == 'README.md':
        fuente = fuente.replace('](docs/', '](')  # en la web, la portada ya está dentro de docs/
    conv = markdown.Markdown(extensions=['tables', 'fenced_code', 'toc', 'sane_lists'],
                             extension_configs={'toc': {'slugify': lambda t, s: re.sub(r'[^a-z0-9]+', '-', _sin_tildes(t).lower()).strip('-')}})
    cuerpo = conv.convert(fuente)
    # Enlaces a otros .md: a sus páginas.
    cuerpo = re.sub(r'href="([^"#:]+)\.md(#[^"]*)?"', lambda m: f'href="{"index" if m.group(1).endswith("README") else m.group(1)}.html{m.group(2) or ""}"', cuerpo)
    # Enlaces de fuera: en otra pestaña.
    cuerpo = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', cuerpo)
    carpeta = DOCS if md_ruta == 'README.md' else origen.parent
    cuerpo = figuras(cuerpo, carpeta)
    # Tablas con desplazamiento propio en pantallas estrechas.
    cuerpo = cuerpo.replace('<table>', '<div class="tabla"><table>').replace('</table>', '</table></div>')
    # Bloques de código con botón de copiar.
    cuerpo = cuerpo.replace('<pre><code', '<div class="codigo"><button class="copiar" type="button">Copiar</button><pre><code').replace('</code></pre>', '</code></pre></div>')

    # Portada: el título y el primer párrafo (y la primera imagen si va justo después).
    m = re.match(r'\s*<h1[^>]*>(.*?)</h1>\s*<p>(.*?)</p>\s*(<figure.*?</figure>)?', cuerpo, re.S)
    titulo, entradilla, figura = m.group(1), m.group(2), m.group(3) or ''
    resto = cuerpo[m.end():]
    texto, indice = bloques(resto)

    raiz = '../' if '/' in md_ruta else ''
    es_portada = md_ruta == 'README.md'
    nav = ''.join(
        f'<a href="{raiz}{r.replace(".md", ".html")}"{" aria-current=\"page\"" if r == md_ruta else ""}>{t}</a>'
        for r, t in MANUALES)
    toc = ''.join(f'<li><a href="#{i}">{html.escape(t)}</a></li>' for i, t in indice)
    pie_nav = ''
    if prev or sig:
        pie_nav = '<nav class="paso" aria-label="Siguiente manual">' + \
            (f'<a class="paso-ant" href="{raiz}{prev[0].replace(".md", ".html")}"><small>Anterior</small>{prev[1]}</a>' if prev else '<span></span>') + \
            (f'<a class="paso-sig" href="{raiz}{sig[0].replace(".md", ".html")}"><small>Siguiente</small>{sig[1]}</a>' if sig else '') + '</nav>'
    descripcion = re.sub('<[^>]+>', '', entradilla)
    return f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(re.sub('<[^>]+>', '', titulo)) if es_portada else titulo_corto + ' · ' + NOMBRE}</title>
<meta name="description" content="{html.escape(descripcion[:160])}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&display=swap">
<link rel="stylesheet" href="{raiz}estilo/manual.css">
</head>
<body class="{'es-portada' if es_portada else 'es-manual'}">
<header class="cabecera" id="cabecera">
  <a class="marca" href="{raiz}index.html">Inicio <span>para Android TV</span></a>
  <nav class="menu" aria-label="Manuales">{nav}</nav>
</header>
<main>
  <section class="portada">
    <h1 class="titular">{titulo}</h1>
    <p class="entradilla">{entradilla}</p>
    {figura.replace('class="figura', 'class="figura figura-portada', 1) if figura else ''}
  </section>
  <div class="cuerpo">
    {f'<aside class="indice" aria-label="En esta página"><p>En esta página</p><ol>{toc}</ol></aside>' if toc and not es_portada else ''}
    <article class="texto">
{texto}
    </article>
  </div>
  {pie_nav}
</main>
<footer class="pie"><p>{NOMBRE} · <a href="{raiz}index.html">Portada</a></p></footer>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/SplitText.min.js"></script>
<script src="{raiz}estilo/manual.js"></script>
</body>
</html>
'''


def _sin_tildes(t):
    return t.translate(str.maketrans('áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))


def main():
    hechas = []
    (DOCS / 'index.html').write_text(pagina('README.md', NOMBRE, None, MANUALES[0]), encoding='utf-8', newline='\n')
    hechas.append('index.html')
    for i, (ruta, titulo) in enumerate(MANUALES):
        prev = MANUALES[i - 1] if i > 0 else None
        sig = MANUALES[i + 1] if i + 1 < len(MANUALES) else None
        destino = DOCS / ruta.replace('.md', '.html')
        destino.write_text(pagina(ruta, titulo, prev, sig), encoding='utf-8', newline='\n')
        hechas.append(str(destino.relative_to(RAIZ)))
    hechas[0] = 'docs/index.html'
    print('Generadas:', ', '.join(hechas))


if __name__ == '__main__':
    sys.exit(main())
