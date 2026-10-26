package es.casa.inicio;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.Normalizer;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Servidor web del mando del móvil (puerto 8765, red de casa). Sin emparejar solo se ve cómo emparejarse;
 * con la cookie del QR: la página del mando y su API. Las peticiones que hacen algo son POST con la cabecera
 * X-Mando (una web ajena no puede ponerla sin permiso CORS, que aquí no se da).
 */
final class Servidor {

    static final int PUERTO = 8765;
    private static final int MAX_CUERPO = 8192;

    // Teclas que el móvil puede pulsar (nombre → KEYCODE de Android). Nada fuera de esta lista.
    private static final Map<String, Integer> TECLAS = new HashMap<>();

    static {
        TECLAS.put("arriba", 19);
        TECLAS.put("abajo", 20);
        TECLAS.put("izquierda", 21);
        TECLAS.put("derecha", 22);
        TECLAS.put("ok", 23);
        TECLAS.put("atras", 4);
        TECLAS.put("inicio", 3);
        TECLAS.put("menu", 82);
        TECLAS.put("volmas", 24);
        TECLAS.put("volmenos", 25);
        TECLAS.put("silencio", 164);
        TECLAS.put("playpausa", 85);
        TECLAS.put("retroceder", 89);
        TECLAS.put("avanzar", 90);
        TECLAS.put("borrar", 67);
        TECLAS.put("encender", 26);
    }

    private static ServerSocket socket;

    private Servidor() {
    }

    static synchronized void arranca(Context ctx) {
        if (socket != null) return;
        Context c = ctx.getApplicationContext();
        try {
            socket = new ServerSocket(PUERTO);
        } catch (IOException e) {
            return; // puerto ocupado: ya hay otro servidor en marcha
        }
        ExecutorService peticiones = Executors.newFixedThreadPool(4);
        new Thread(() -> {
            while (!socket.isClosed()) {
                try {
                    Socket s = socket.accept();
                    peticiones.execute(() -> atiende(c, s));
                } catch (IOException ignorada) {
                    // Conexión rota: se sigue esperando la siguiente.
                }
            }
        }, "mando").start();
    }

    /* ---------- HTTP mínimo ---------- */

    private static final class Peticion {
        String metodo, ruta, query = "";
        final Map<String, String> cabeceras = new HashMap<>();
        byte[] cuerpo = new byte[0];

        String cookie(String nombre) {
            String todas = cabeceras.get("cookie");
            if (todas == null) return null;
            for (String par : todas.split(";")) {
                String[] kv = par.trim().split("=", 2);
                if (kv.length == 2 && kv[0].equals(nombre)) return kv[1];
            }
            return null;
        }

        String param(String nombre) {
            for (String par : query.split("&")) {
                String[] kv = par.split("=", 2);
                if (kv.length == 2 && kv[0].equals(nombre)) {
                    try {
                        return URLDecoder.decode(kv[1], "UTF-8");
                    } catch (Exception e) {
                        return null;
                    }
                }
            }
            return null;
        }
    }

    private static String linea(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int ch;
        while ((ch = in.read()) != -1 && ch != '\n') {
            if (ch != '\r') b.write(ch);
            if (b.size() > 8192) throw new IOException("línea demasiado larga");
        }
        return ch == -1 && b.size() == 0 ? null : b.toString("ISO-8859-1");
    }

    private static void atiende(Context c, Socket s) {
        try (Socket sock = s) {
            sock.setSoTimeout(10_000);
            InputStream in = new BufferedInputStream(sock.getInputStream());
            String primera = linea(in);
            if (primera == null) return;
            String[] p = primera.split(" ");
            if (p.length < 2) return;
            Peticion r = new Peticion();
            r.metodo = p[0];
            int q = p[1].indexOf('?');
            r.ruta = q >= 0 ? p[1].substring(0, q) : p[1];
            if (q >= 0) r.query = p[1].substring(q + 1);
            String l;
            while ((l = linea(in)) != null && !l.isEmpty()) {
                int dp = l.indexOf(':');
                if (dp > 0) r.cabeceras.put(l.substring(0, dp).trim().toLowerCase(Locale.ROOT), l.substring(dp + 1).trim());
            }
            int largo = 0;
            try {
                largo = Integer.parseInt(r.cabeceras.getOrDefault("content-length", "0"));
            } catch (NumberFormatException ignorada) {
                // sin cuerpo
            }
            if ("/api/instalar".equals(r.ruta)) {
                recibeApk(c, r, in, sock, largo);
                return;
            }
            if (largo > MAX_CUERPO) {
                responde(sock.getOutputStream(), 413, "text/plain", "Demasiado grande".getBytes(StandardCharsets.UTF_8), null);
                return;
            }
            r.cuerpo = new byte[largo];
            int leido = 0;
            while (leido < largo) {
                int n = in.read(r.cuerpo, leido, largo - leido);
                if (n < 0) break;
                leido += n;
            }
            enruta(c, r, sock.getOutputStream());
        } catch (Exception ignorada) {
            // Petición rota o móvil que se fue: nada que hacer.
        }
    }

    /**
     * Un APK del móvil: el cuerpo es el archivo tal cual (hasta 300 MB) y va directo a disco, nunca a memoria.
     * Mismas reglas que el resto de la API (emparejado, POST, X-Mando); el nombre llega en X-Nombre.
     */
    private static void recibeApk(Context c, Peticion r, InputStream in, Socket sock, int largo) throws Exception {
        OutputStream out = sock.getOutputStream();
        if (!Moviles.valido(c, r.cookie(Moviles.COOKIE))) {
            json(out, 403, new JSONObject().put("error", "Este móvil no está emparejado. Escanea el QR de la tele."));
            return;
        }
        if (!"POST".equals(r.metodo) || !"1".equals(r.cabeceras.get("x-mando"))) {
            json(out, 404, new JSONObject().put("error", "No existe"));
            return;
        }
        if (largo <= 0 || largo > Instalador.MAX) {
            json(out, 413, new JSONObject().put("error", "El archivo pasa de 300 MB."));
            return;
        }
        String archivo = nombreArchivo(r.cabeceras.get("x-nombre"));
        if (!Instalador.reservaMovil(archivo)) {
            json(out, 409, new JSONObject().put("error", "Ya hay una instalación en marcha. Espera a que acabe."));
            return;
        }
        sock.setSoTimeout(30_000); // la wifi del móvil puede pararse un momento
        // En los archivos de la app del almacenamiento compartido: `pm install` (shell) tiene que poder leerlo.
        File carpeta = c.getExternalFilesDir(null);
        File destino = new File(carpeta != null ? carpeta : c.getCacheDir(), "movil.apk");
        long leido = 0;
        boolean noEsApk = false;
        try (FileOutputStream f = new FileOutputStream(destino)) {
            byte[] buf = new byte[64 * 1024];
            int ultimo = -1;
            while (leido < largo) {
                int n = in.read(buf, 0, (int) Math.min(buf.length, largo - leido));
                if (n < 0) break;
                // Un APK es un ZIP: empieza por «PK\3\4».
                if (leido == 0 && (n < 4 || buf[0] != 'P' || buf[1] != 'K' || buf[2] != 3 || buf[3] != 4)) {
                    noEsApk = true;
                    break;
                }
                f.write(buf, 0, n);
                leido += n;
                int pct = (int) (leido * 100 / largo);
                if (pct != ultimo) Instalador.recibido(archivo, ultimo = pct);
            }
        } catch (IOException cortada) {
            // Se trata abajo: no llegó entero.
        }
        if (leido != largo) {
            if (!destino.delete()) destino.deleteOnExit();
            String error = noEsApk ? "Eso no es un archivo .apk." : "La subida se cortó. Vuelve a probar.";
            Instalador.subidaFallida(archivo, error);
            json(out, 400, new JSONObject().put("error", error));
            return;
        }
        json(out, 200, new JSONObject().put("ok", true));
        Instalador.instalaDelMovil(c, destino, archivo);
    }

    /** Nombre del archivo para enseñarlo (solo eso): sin carpetas ni caracteres de control. */
    private static String nombreArchivo(String cabecera) {
        String n = "app.apk";
        if (cabecera != null) {
            try {
                n = URLDecoder.decode(cabecera, "UTF-8");
            } catch (Exception ignorada) {
                // Se queda el genérico.
            }
        }
        n = n.substring(Math.max(n.lastIndexOf('/'), n.lastIndexOf('\\')) + 1).replaceAll("\\p{Cntrl}", "").trim();
        if (n.isEmpty()) n = "app.apk";
        return n.length() > 80 ? n.substring(0, 80) : n;
    }

    private static void responde(OutputStream out, int codigo, String tipo, byte[] cuerpo, String extra) throws IOException {
        String estado = codigo == 200 ? "OK" : codigo == 303 ? "See Other" : codigo == 403 ? "Forbidden" : codigo == 404 ? "Not Found" : "Error";
        String cab = "HTTP/1.1 " + codigo + " " + estado + "\r\n"
                + "Content-Type: " + tipo + "\r\n"
                + "Content-Length: " + cuerpo.length + "\r\n"
                + "Cache-Control: no-store\r\n"
                + "X-Content-Type-Options: nosniff\r\n"
                + "Referrer-Policy: no-referrer\r\n"
                + "Connection: close\r\n"
                + (extra != null ? extra : "") + "\r\n";
        out.write(cab.getBytes(StandardCharsets.ISO_8859_1));
        out.write(cuerpo);
        out.flush();
    }

    private static void json(OutputStream out, int codigo, Object datos) throws IOException {
        responde(out, codigo, "application/json; charset=utf-8", datos.toString().getBytes(StandardCharsets.UTF_8), null);
    }

    private static byte[] asset(Context c, String ruta) throws IOException {
        try (InputStream in = c.getAssets().open("www/" + ruta)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return b.toByteArray();
        }
    }

    /* ---------- Rutas ---------- */

    private static void enruta(Context c, Peticion r, OutputStream out) throws Exception {
        boolean emparejado = Moviles.valido(c, r.cookie(Moviles.COOKIE));

        if ("GET".equals(r.metodo) && r.ruta.startsWith("/e/")) {
            String codigo = r.ruta.substring(3);
            if (codigo.matches("[A-Za-z0-9_-]{16,40}") && Moviles.canjea(codigo)) {
                String token = Moviles.alta(c, Moviles.nombre(r.cabeceras.get("user-agent")));
                responde(out, 303, "text/plain", new byte[0], "Location: /?nuevo=1\r\n"
                        + "Set-Cookie: " + Moviles.COOKIE + "=" + token + "; Max-Age=315360000; Path=/; HttpOnly; SameSite=Lax\r\n");
            } else {
                responde(out, 403, "text/html; charset=utf-8", asset(c, "mando-sin.html"), null);
            }
            return;
        }
        if ("GET".equals(r.metodo) && r.ruta.startsWith("/fonts/") && r.ruta.matches("/fonts/[a-z0-9-]+\\.woff2")) {
            responde(out, 200, "font/woff2", asset(c, r.ruta.substring(1)), "Cache-Control: max-age=604800\r\n");
            return;
        }
        if ("GET".equals(r.metodo) && "/".equals(r.ruta)) {
            responde(out, emparejado ? 200 : 403, "text/html; charset=utf-8", asset(c, emparejado ? "mando.html" : "mando-sin.html"), null);
            return;
        }
        if (!emparejado) {
            json(out, 403, new JSONObject().put("error", "Este móvil no está emparejado. Escanea el QR de la tele."));
            return;
        }

        // A partir de aquí, solo móviles emparejados.
        if ("GET".equals(r.metodo) && "/api/estado".equals(r.ruta)) {
            json(out, 200, new JSONObject().put("adb", AdbPropio.estado()));
            return;
        }
        if ("GET".equals(r.metodo) && "/api/apps".equals(r.ruta)) {
            Puente pu = new Puente(c);
            JSONArray apps = new JSONArray(pu.apps()), salida = new JSONArray();
            for (int i = 0; i < apps.length(); i++) {
                JSONObject a = apps.getJSONObject(i);
                if (a.has("banner")) a.put("banner", "/banner?p=" + a.getString("pkg"));
                salida.put(a);
            }
            json(out, 200, new JSONObject().put("apps", salida).put("favoritas", new JSONArray(pu.favoritas())));
            return;
        }
        if ("GET".equals(r.metodo) && "/api/instalacion".equals(r.ruta)) {
            json(out, 200, new JSONObject(Instalador.estado()));
            return;
        }
        if ("GET".equals(r.metodo) && "/banner".equals(r.ruta)) {
            String pkg = r.param("p");
            File dir = new File(c.getFilesDir(), "banners");
            File[] fs = pkg != null && pkg.matches("[A-Za-z0-9_.]+") ? dir.listFiles((d, n) -> n.startsWith(pkg + "-") && n.endsWith(".png")) : null;
            if (fs == null || fs.length == 0) {
                responde(out, 404, "text/plain", new byte[0], null);
            } else {
                responde(out, 200, "image/png", Files.readAllBytes(fs[0].toPath()), "Cache-Control: max-age=86400\r\n");
            }
            return;
        }
        if (!"POST".equals(r.metodo) || !"1".equals(r.cabeceras.get("x-mando"))) {
            json(out, 404, new JSONObject().put("error", "No existe"));
            return;
        }
        JSONObject p;
        try {
            p = new JSONObject(new String(r.cuerpo, StandardCharsets.UTF_8));
        } catch (org.json.JSONException e) {
            json(out, 400, new JSONObject().put("error", "Petición mal formada"));
            return;
        }
        switch (r.ruta) {
            case "/api/tecla": {
                Integer k = TECLAS.get(p.optString("k"));
                if (k == null) {
                    json(out, 400, new JSONObject().put("error", "Tecla desconocida"));
                    return;
                }
                AdbPropio.ejecuta(c, "input keyevent " + k);
                break;
            }
            case "/api/texto": {
                String t = texto(p.optString("t"));
                if (t.isEmpty()) {
                    json(out, 400, new JSONObject().put("error", "Texto vacío"));
                    return;
                }
                AdbPropio.ejecuta(c, "input text '" + t + "'");
                break;
            }
            case "/api/abrir": {
                String pkg = p.optString("pkg");
                if (!pkg.matches("[A-Za-z0-9_.]{3,120}")) {
                    json(out, 400, new JSONObject().put("error", "App no válida"));
                    return;
                }
                new Puente(c).abrir(pkg);
                break;
            }
            default:
                json(out, 404, new JSONObject().put("error", "No existe"));
                return;
        }
        json(out, 200, new JSONObject().put("ok", true));
    }

    /**
     * Texto para `input text` entre comillas simples: sin tildes (input no las admite), solo ASCII imprimible,
     * espacios como %s y la comilla simple escapada para el shell.
     */
    static String texto(String s) {
        String t = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('ñ', 'n').replace('Ñ', 'N').replaceAll("[^\\x20-\\x7E]", "");
        if (t.length() > 200) t = t.substring(0, 200);
        return t.replace("%", "\\%").replace(" ", "%s").replace("'", "'\\''");
    }
}
