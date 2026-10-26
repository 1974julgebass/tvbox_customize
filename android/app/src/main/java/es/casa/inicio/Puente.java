package es.casa.inicio;

import android.app.ActivityManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Environment;
import android.os.StatFs;
import android.os.SystemClock;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Lo que la página puede pedir a la caja (window.TVHome). Todo devuelve JSON en texto. */
public class Puente {

    private static final long DIA = 24L * 3600 * 1000;

    // Apps que no salen en la pantalla: la propia, los otros inicios y Ajustes (que tiene su tarjeta).
    private static final Set<String> OCULTAS = new HashSet<>(java.util.Arrays.asList(
            "es.casa.inicio", "com.google.android.tvlauncher", "com.google.android.leanbacklauncher",
            "com.android.tv.settings", "com.mitv.tvhome.atv"));

    // Orden de favoritas por defecto mientras el panel del PC no guarde otro.
    private static final String[] FAVORITAS_DEFECTO = {
            "com.movistarplus.androidtv", "com.google.android.youtube.tv", "com.filmin.androidtv",
            "com.rtve.androidtv", "com.antena3.atresplayer.tv", "org.videolan.vlc"};

    private final Context ctx;
    private final SharedPreferences prefs;

    Puente(Context ctx) {
        this.ctx = ctx.getApplicationContext();
        this.prefs = ctx.getSharedPreferences("inicio", Context.MODE_PRIVATE);
    }

    /** Apps con lanzador: [{pkg, nombre, banner?, color, ultimo, usos}]. */
    @JavascriptInterface
    public String apps() {
        PackageManager pm = ctx.getPackageManager();
        Map<String, long[]> usos = usos();
        Map<String, JSONObject> lista = new LinkedHashMap<>();
        String[] categorias = {Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER};
        for (String cat : categorias) {
            Intent i = new Intent(Intent.ACTION_MAIN).addCategory(cat);
            for (ResolveInfo r : pm.queryIntentActivities(i, 0)) {
                String pkg = r.activityInfo.packageName;
                if (OCULTAS.contains(pkg) || lista.containsKey(pkg)) continue;
                try {
                    JSONObject o = new JSONObject();
                    o.put("pkg", pkg);
                    o.put("nombre", r.loadLabel(pm).toString());
                    Iconos.Imagen img = Iconos.de(ctx, pm, r.activityInfo);
                    if (img.banner != null) o.put("banner", img.banner);
                    o.put("color", img.color);
                    long[] u = usos.get(pkg);
                    o.put("ultimo", u != null ? u[0] : 0);
                    o.put("usos", u != null ? u[1] : 0);
                    lista.put(pkg, o);
                } catch (JSONException ignorada) {
                    // Una app rara no rompe la lista.
                }
            }
        }
        return new JSONArray(lista.values()).toString();
    }

    /** Paquetes favoritos en orden. */
    @JavascriptInterface
    public String favoritas() {
        String guardadas = prefs.getString("favoritas", null);
        if (guardadas != null) return guardadas;
        return new JSONArray(java.util.Arrays.asList(FAVORITAS_DEFECTO)).toString();
    }

    @JavascriptInterface
    public void guardaFavoritas(String json) {
        if (esLista(json)) prefs.edit().putString("favoritas", json).apply();
    }

    @JavascriptInterface
    public String ocultas() {
        return prefs.getString("ocultas", "[]");
    }

    @JavascriptInterface
    public void guardaOcultas(String json) {
        if (esLista(json)) prefs.edit().putString("ocultas", json).apply();
    }

    private static boolean esLista(String json) {
        try {
            new JSONArray(json);
            return true;
        } catch (JSONException e) {
            return false;
        }
    }

    /** Wifi, memoria, espacio y tiempo encendida. */
    @JavascriptInterface
    public String estado() {
        JSONObject o = new JSONObject();
        try {
            WifiManager wm = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
            WifiInfo wi = wm != null ? wm.getConnectionInfo() : null;
            if (wi != null && wi.getNetworkId() != -1) {
                o.put("wifi", new JSONObject().put("rssi", wi.getRssi()).put("mbps", wi.getLinkSpeed()));
            }
            ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            o.put("ram", new JSONObject().put("total", mi.totalMem).put("libre", mi.availMem));
            StatFs st = new StatFs(Environment.getDataDirectory().getPath());
            o.put("disco", new JSONObject().put("total", st.getTotalBytes()).put("libre", st.getAvailableBytes()));
            o.put("encendida", SystemClock.elapsedRealtime() / 1000);
        } catch (JSONException ignorada) {
            // Devuelve lo que haya podido reunir.
        }
        return o.toString();
    }

    /** Guía de TV de esos canales; {"cargando":true} mientras la caja la descarga. */
    @JavascriptInterface
    public String guia(String canales) {
        return Guia.consulta(ctx, canales.split(","));
    }

    /** Lo último que se ha visto con esa app (lo apunta el servicio Escucha). */
    @JavascriptInterface
    public String historial(String pkg) {
        return Historial.de(ctx, pkg).toString();
    }

    /** Avisos de programas pendientes. */
    @JavascriptInterface
    public String avisos() {
        return Avisos.lista(ctx).toString();
    }

    @JavascriptInterface
    public void ponAviso(String json) {
        try {
            Avisos.pon(ctx, json);
        } catch (JSONException ignorada) {
            // Aviso mal formado: no se guarda.
        }
    }

    @JavascriptInterface
    public void quitaAviso(String id) {
        Avisos.saca(ctx, id);
    }

    /** Enlace del QR para emparejar un móvil con el mando: {url, caduca (s), adb}. Prepara también el ADB propio. */
    @JavascriptInterface
    public String codigoMovil() {
        AdbPropio.prepara(ctx);
        WifiManager wm = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
        int ip = wm != null ? wm.getConnectionInfo().getIpAddress() : 0;
        String host = (ip & 0xff) + "." + (ip >> 8 & 0xff) + "." + (ip >> 16 & 0xff) + "." + (ip >> 24 & 0xff);
        try {
            return new JSONObject()
                    .put("url", "http://" + host + ":" + Servidor.PUERTO + "/e/" + Moviles.codigoNuevo())
                    .put("caduca", System.currentTimeMillis() / 1000 + 300)
                    .put("adb", AdbPropio.estado()).toString();
        } catch (JSONException e) {
            return "{}";
        }
    }

    @JavascriptInterface
    public String estadoAdb() {
        return AdbPropio.estado();
    }

    /** Móviles emparejados (sin secretos). */
    @JavascriptInterface
    public String moviles() {
        return Moviles.publica(ctx).toString();
    }

    @JavascriptInterface
    public void quitaMovil(String id) {
        Moviles.quita(ctx, id);
    }

    /** Los .apk que hay en la caja (Descargas, almacenamiento y pendrives). */
    @JavascriptInterface
    public String apks() {
        return Instalador.lista(ctx);
    }

    /** Instala uno de la lista; false si no está en ella o ya hay otra instalación en marcha. */
    @JavascriptInterface
    public boolean instalaApk(String ruta) {
        return Instalador.instalaDeCaja(ctx, ruta);
    }

    /** Cómo va la instalación en curso o la última (también las que llegan del móvil). */
    @JavascriptInterface
    public String instalacion() {
        return Instalador.estado();
    }

    /** Temporizador de apagado: minutos (0 = cancelar). */
    @JavascriptInterface
    public void temporizador(int minutos) {
        Temporizador.pon(ctx, minutos);
    }

    /** Hora (ms) a la que se apagará, o 0. */
    @JavascriptInterface
    public long temporizadorFin() {
        return Temporizador.fin(ctx);
    }

    /** Avisos automáticos: {palabras: [...], canales: {canal: pkg}}. */
    @JavascriptInterface
    public String palabras() {
        return Palabras.config(ctx);
    }

    @JavascriptInterface
    public void guardaPalabras(String json) {
        try {
            Palabras.guarda(ctx, json);
        } catch (JSONException ignorada) {
            // Configuración mal formada: no se guarda.
        }
        Guia.renueva(ctx);
    }

    /** Abre un enlace dentro de esa app (p. ej. un canal en directo de Atresplayer); si no lo entiende, abre la app. */
    @JavascriptInterface
    public void abrirEnlace(String pkg, String url) {
        Intent i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)).setPackage(pkg);
        if (!lanza(i)) abrir(pkg);
    }

    /** Abre YouTube con esa búsqueda (la app de TV entiende el enlace de resultados). */
    @JavascriptInterface
    public void buscaYouTube(String q) {
        Intent i = new Intent(Intent.ACTION_VIEW,
                android.net.Uri.parse("https://www.youtube.com/results?search_query=" + android.net.Uri.encode(q)))
                .setPackage("com.google.android.youtube.tv");
        if (!lanza(i)) {
            lanza(new Intent(Intent.ACTION_SEARCH).setPackage("com.google.android.youtube.tv")
                    .putExtra(android.app.SearchManager.QUERY, q));
        }
    }

    @JavascriptInterface
    public void abrir(String pkg) {
        PackageManager pm = ctx.getPackageManager();
        Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
        if (i == null) i = pm.getLaunchIntentForPackage(pkg);
        if (i == null) return;
        lanza(i);
    }

    @JavascriptInterface
    public void sistema(String accion) {
        Intent i;
        if (accion.startsWith("info:")) {
            // Ficha de la app en Ajustes: forzar cierre, borrar datos, desinstalar.
            lanza(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    android.net.Uri.fromParts("package", accion.substring(5), null)));
            return;
        }
        if ("apagar".equals(accion)) {
            if (!Accion.menuApagado()) lanza(new Intent(Settings.ACTION_SETTINGS));
            return;
        }
        if ("reposo".equals(accion)) {
            Accion.reposo();
            return;
        }
        switch (accion) {
            case "wifi": i = new Intent(Settings.ACTION_WIFI_SETTINGS); break;
            // Android deja borrar ahí los «datos en caché»; una app normal no puede vaciar la caché de otras.
            case "espacio": i = new Intent(Settings.ACTION_INTERNAL_STORAGE_SETTINGS); break;
            case "apps": i = new Intent(Settings.ACTION_APPLICATION_SETTINGS); break;
            case "google":
                i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                        .setComponent(new ComponentName("com.google.android.tvlauncher", "com.google.android.tvlauncher.MainActivity"));
                break;
            default: i = new Intent(Settings.ACTION_SETTINGS);
        }
        lanza(i);
    }

    private boolean lanza(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        try {
            ctx.startActivity(i);
            return true;
        } catch (ActivityNotFoundException | SecurityException ignorada) {
            return false; // No existe en esta caja.
        }
    }

    /** pkg → {última vez en primer plano, veces abierta en 7 días}. Vacío sin el permiso de uso. */
    private Map<String, long[]> usos() {
        Map<String, long[]> m = new HashMap<>();
        UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return m;
        long fin = System.currentTimeMillis(), ini = fin - 7 * DIA;
        try {
            for (Map.Entry<String, UsageStats> e : usm.queryAndAggregateUsageStats(ini, fin).entrySet()) {
                m.put(e.getKey(), new long[]{e.getValue().getLastTimeUsed(), 0});
            }
            UsageEvents ev = usm.queryEvents(ini, fin);
            UsageEvents.Event e = new UsageEvents.Event();
            while (ev.hasNextEvent()) {
                ev.getNextEvent(e);
                if (e.getEventType() != UsageEvents.Event.MOVE_TO_FOREGROUND) continue;
                long[] u = m.get(e.getPackageName());
                if (u == null) m.put(e.getPackageName(), u = new long[]{e.getTimeStamp(), 0});
                u[1]++;
            }
        } catch (SecurityException sinPermiso) {
            // Sin GET_USAGE_STATS: la pantalla funciona igual, sin «última vez».
        }
        return m;
    }
}
