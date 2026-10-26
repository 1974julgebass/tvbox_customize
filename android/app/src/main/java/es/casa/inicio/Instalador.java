package es.casa.inicio;

import android.Manifest;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Environment;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Instalar apps: busca los .apk de la caja (Descargas, resto del almacenamiento y pendrives) o recibe uno del
 * móvil, y lo instala con el ADB propio (sin el diálogo de Android). Una instalación cada vez; su estado lo leen
 * la pantalla de inicio y el mando para pintar el progreso.
 */
final class Instalador {

    static final long MAX = 300L * 1024 * 1024;
    private static final int MAX_LISTA = 60;
    private static final int HONDO = 4; // carpetas de profundidad al buscar

    private static final AtomicBoolean ocupado = new AtomicBoolean();
    private static final Set<String> vistas = ConcurrentHashMap.newKeySet(); // rutas que la tele puede instalar
    private static volatile JSONObject estado = new JSONObject();

    private Instalador() {
    }

    /* ---------- Buscar ---------- */

    /** Los .apk de la caja, los más nuevos primero: [{ruta, archivo, nombre?, pkg?, version?, tam, origen, icono?, instalada?, comparada?}]. */
    static String lista(Context c) {
        permiso(c);
        List<File> encontrados = new ArrayList<>();
        File interna = Environment.getExternalStorageDirectory();
        busca(interna, 0, encontrados);
        File[] volumenes = new File("/storage").listFiles();
        if (volumenes != null) {
            for (File v : volumenes) {
                String n = v.getName();
                if (n.equals("emulated") || n.equals("self") || !v.canRead()) continue;
                busca(v, 0, encontrados);
            }
        }
        encontrados.sort((a, b) -> Long.compare(b.lastModified(), a.lastModified()));

        PackageManager pm = c.getPackageManager();
        JSONArray salida = new JSONArray();
        vistas.clear();
        String raizInterna = interna.getAbsolutePath();
        for (File f : encontrados) {
            if (salida.length() >= MAX_LISTA) break;
            try {
                JSONObject o = new JSONObject();
                String ruta = f.getAbsolutePath();
                o.put("ruta", ruta).put("archivo", f.getName()).put("tam", f.length());
                o.put("origen", !ruta.startsWith(raizInterna) ? "USB"
                        : ruta.startsWith(raizInterna + "/Download") ? "Descargas" : "Caja");
                describe(c, pm, f, o);
                salida.put(o);
                vistas.add(ruta);
            } catch (JSONException ignorada) {
                // Un archivo raro no rompe la lista.
            }
        }
        return salida.toString();
    }

    /** Leer el almacenamiento: la app se da el permiso a sí misma por ADB la primera vez. */
    private static void permiso(Context c) {
        if (c.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED) return;
        AdbPropio.ejecutaYEspera(c, "pm grant " + c.getPackageName() + " " + Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    private static void busca(File dir, int nivel, List<File> salida) {
        File[] hijos = dir.listFiles();
        if (hijos == null) return;
        for (File f : hijos) {
            String n = f.getName();
            if (n.startsWith(".")) continue;
            if (f.isDirectory()) {
                // Android/ son datos de las apps (miles de archivos): ahí no hay nada que instalar a mano.
                if (nivel < HONDO && !(nivel == 0 && n.equals("Android"))) busca(f, nivel + 1, salida);
            } else if (n.toLowerCase(Locale.ROOT).endsWith(".apk") && f.length() > 0 && f.canRead()) {
                salida.add(f);
            }
        }
    }

    /** Nombre, paquete, versión e icono sacados del propio APK, y cómo está respecto a lo instalado. */
    private static void describe(Context c, PackageManager pm, File f, JSONObject o) throws JSONException {
        PackageInfo pi = pm.getPackageArchiveInfo(f.getAbsolutePath(), 0);
        if (pi == null || pi.applicationInfo == null) {
            o.put("roto", true);
            return;
        }
        ApplicationInfo ai = pi.applicationInfo;
        ai.sourceDir = ai.publicSourceDir = f.getAbsolutePath();
        o.put("pkg", pi.packageName);
        o.put("nombre", pm.getApplicationLabel(ai).toString());
        if (pi.versionName != null) o.put("version", pi.versionName);
        try {
            File dir = new File(c.getFilesDir(), "apk-iconos");
            if (!dir.isDirectory()) dir.mkdirs();
            File png = new File(dir, pi.packageName + "-" + pi.getLongVersionCode() + ".png");
            if (!png.exists()) {
                Bitmap b = Iconos.aBitmap(ai.loadIcon(pm), 96, 96);
                Iconos.guarda(Bitmap.createScaledBitmap(b, 96, 96, true), png);
            }
            if (png.exists()) o.put("icono", "file://" + png.getAbsolutePath());
        } catch (RuntimeException ignorada) {
            // Sin icono: la página pone uno genérico.
        }
        try {
            PackageInfo ya = pm.getPackageInfo(pi.packageName, 0);
            o.put("instalada", ya.versionName != null ? ya.versionName : "");
            long a = pi.getLongVersionCode(), b = ya.getLongVersionCode();
            o.put("comparada", a > b ? "nueva" : a == b ? "igual" : "vieja");
        } catch (PackageManager.NameNotFoundException noEsta) {
            // No instalada todavía.
        }
    }

    /* ---------- Instalar ---------- */

    static boolean ocupado() {
        return ocupado.get();
    }

    /** OK sobre un archivo de la lista de la tele. Solo rutas que salieron en la última lista. */
    static boolean instalaDeCaja(Context c, String ruta) {
        if (ruta == null || !vistas.contains(ruta) || !ocupado.compareAndSet(false, true)) return false;
        File f = new File(ruta);
        pon("instalando", f.getName(), "caja", 100, null, null); // ya, para que la página lo vea al momento
        new Thread(() -> instala(c.getApplicationContext(), f, f.getName(), "caja", false), "instalar").start();
        return true;
    }

    /** El móvil empieza a mandar un archivo: reserva el turno. False si ya hay otra instalación. */
    static boolean reservaMovil(String archivo) {
        if (!ocupado.compareAndSet(false, true)) return false;
        pon("recibiendo", archivo, "movil", 0, null, null);
        return true;
    }

    static void recibido(String archivo, int pct) {
        pon("recibiendo", archivo, "movil", pct, null, null);
    }

    /** Falló la subida (cortada, no era un APK…): libera el turno. */
    static void subidaFallida(String archivo, String error) {
        pon("error", archivo, "movil", 0, null, error);
        ocupado.set(false);
    }

    /** Archivo del móvil ya entero en la caja: se instala en segundo plano y se borra al acabar. */
    static void instalaDelMovil(Context c, File f, String archivo) {
        new Thread(() -> instala(c.getApplicationContext(), f, archivo, "movil", true), "instalar").start();
    }

    private static void instala(Context c, File f, String archivo, String origen, boolean borrar) {
        try {
            PackageManager pm = c.getPackageManager();
            PackageInfo pi = pm.getPackageArchiveInfo(f.getAbsolutePath(), 0);
            if (pi == null || pi.applicationInfo == null) {
                termina(c, archivo, origen, null, "El archivo no es un APK válido o está dañado.");
                return;
            }
            pi.applicationInfo.sourceDir = pi.applicationInfo.publicSourceDir = f.getAbsolutePath();
            String nombre = pm.getApplicationLabel(pi.applicationInfo).toString();
            pon("instalando", nombre, origen, 100, pi.packageName, null);
            if ("movil".equals(origen)) {
                AvisoReceptor.muestra(c, "Desde el móvil", "Instalando " + nombre + "…", "Tarda unos segundos", 8_000);
            }
            String fallo = AdbPropio.instala(c, f);
            termina(c, nombre, origen, pi.packageName, fallo == null ? null : traduce(fallo));
        } finally {
            if (borrar && !f.delete()) f.deleteOnExit();
            ocupado.set(false);
        }
    }

    private static void termina(Context c, String nombre, String origen, String pkg, String error) {
        // «Abrir» solo si tiene pantalla que abrir (hay APK que son solo servicios o configuración).
        PackageManager pm = c.getPackageManager();
        boolean abrible = error == null && pkg != null
                && (pm.getLeanbackLaunchIntentForPackage(pkg) != null || pm.getLaunchIntentForPackage(pkg) != null);
        pon(error == null ? "hecha" : "error", nombre, origen, 100, pkg, error);
        try {
            estado.put("abrible", abrible);
        } catch (JSONException ignorada) {
            // Sin el dato, la página no ofrece «Abrir».
        }
        if ("movil".equals(origen)) {
            if (error == null) AvisoReceptor.muestra(c, "Desde el móvil", nombre + " instalada",
                    abrible ? "Ya está en Todas las apps" : "Instalada correctamente", 12_000);
            else AvisoReceptor.muestra(c, "Desde el móvil", "No se ha instalado " + nombre, error, 15_000);
        }
    }

    /** Los fallos de Android, en cristiano. */
    static String traduce(String m) {
        if (m.equals("SIN_ADB")) return "La caja aún no tiene permiso: acepta «¿Permitir depuración?» en la tele y vuelve a probar.";
        if (m.contains("VERSION_DOWNGRADE")) return "Ya tienes una versión más nueva de esta app.";
        if (m.contains("UPDATE_INCOMPATIBLE") || m.contains("SIGNATURES")) return "La que tienes instalada viene de otro sitio: desinstálala primero.";
        if (m.contains("INSUFFICIENT_STORAGE")) return "No queda espacio en la caja. Prueba con «Liberar espacio».";
        if (m.contains("NO_MATCHING_ABIS")) return "Esta app no es para el procesador de esta caja.";
        if (m.contains("OLDER_SDK")) return "Esta app necesita un Android más nuevo que el de la caja.";
        if (m.contains("VERIFICATION") || m.contains("USER_RESTRICTED") || m.contains("ABORTED")) return "Android la ha bloqueado (Play Protect o se canceló en la tele).";
        if (m.contains("PARSE_FAILED") || m.contains("INVALID_APK")) return "El archivo no es un APK válido o está dañado.";
        if (m.contains("DUPLICATE_PERMISSION") || m.contains("CONFLICTING_PROVIDER")) return "Choca con otra app que ya tienes instalada.";
        return "Android no la ha instalado (" + m.replaceAll("\\s+", " ").trim() + ").";
    }

    /* ---------- Estado ---------- */

    private static void pon(String fase, String nombre, String origen, int pct, String pkg, String error) {
        try {
            JSONObject o = new JSONObject().put("fase", fase).put("nombre", nombre).put("origen", origen)
                    .put("pct", pct).put("t", System.currentTimeMillis());
            if (pkg != null) o.put("pkg", pkg);
            if (error != null) o.put("error", error);
            estado = o;
        } catch (JSONException ignorada) {
            // No pasa con estos valores.
        }
    }

    /** {fase: recibiendo|instalando|hecha|error, nombre, origen: caja|movil, pct, pkg?, error?, t} o {} si nada. */
    static String estado() {
        return estado.toString();
    }
}
