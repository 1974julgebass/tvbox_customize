package es.casa.inicio;

import android.content.Context;
import android.util.Xml;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.zip.GZIPInputStream;

/**
 * Guía de TV de la XMLTV pública de EPG_dobleM (github.com/davidmuma/EPG_dobleM). El .gz (~8 MB) se descarga
 * en segundo plano como mucho cada 6 horas y se lee en streaming quedándose solo con los canales que la página
 * ha pedido alguna vez y las próximas 14 horas. Mismo formato que api/guia.php del panel.
 */
final class Guia {

    private static final String URL_GUIA = "https://raw.githubusercontent.com/davidmuma/EPG_dobleM/master/guiatv.xml.gz";
    private static final long VIGENCIA = 6L * 3600 * 1000;
    private static final long VENTANA = 14L * 3600 * 1000;

    private static final Set<String> pedidos = Collections.synchronizedSet(new HashSet<>());
    private static volatile boolean descargando;
    private static volatile String error;

    private Guia() {
    }

    /** Descarga de fondo (alarma de cada 6 h): guía al día para los avisos automáticos aunque nadie abra el inicio. */
    static void renueva(Context ctx) {
        File f = new File(ctx.getFilesDir(), "guia.json");
        JSONObject guardada = lee(f);
        JSONObject datos = guardada != null ? guardada.optJSONObject("canales") : null;
        if (datos != null) for (java.util.Iterator<String> it = datos.keys(); it.hasNext(); ) pedidos.add(it.next());
        pedidos.addAll(Palabras.canales(ctx));
        if (!descargando) descarga(ctx.getApplicationContext(), f);
    }

    static String consulta(Context ctx, String[] canales) {
        for (String c : canales) pedidos.add(c.trim());
        pedidos.addAll(Palabras.canales(ctx));
        File f = new File(ctx.getFilesDir(), "guia.json");
        JSONObject guardada = lee(f);
        // Una guía guardada sin logos es de la versión anterior: se renueva.
        long edad = guardada != null && guardada.has("logos")
                ? System.currentTimeMillis() - guardada.optLong("actualizada") : Long.MAX_VALUE;
        JSONObject datos = guardada != null ? guardada.optJSONObject("canales") : null;
        boolean faltan = datos == null;
        if (datos != null) {
            // Los canales ya guardados siguen pidiéndose: una descarga nueva no debe perderlos.
            for (java.util.Iterator<String> it = datos.keys(); it.hasNext(); ) pedidos.add(it.next());
            for (String c : canales) faltan |= !datos.has(c.trim());
        }

        if ((faltan || edad > VIGENCIA) && !descargando) descarga(ctx.getApplicationContext(), f);

        try {
            if (faltan) {
                return error != null && !descargando
                        ? new JSONObject().put("error", error).toString()
                        : new JSONObject().put("cargando", true).toString();
            }
            JSONObject salida = new JSONObject();
            long ahora = System.currentTimeMillis() / 1000;
            for (String c : canales) {
                JSONArray todos = datos.optJSONArray(c.trim()), vivos = new JSONArray();
                if (todos != null) {
                    for (int i = 0; i < todos.length(); i++) {
                        JSONObject p = todos.getJSONObject(i);
                        if (p.getLong("fin") > ahora) vivos.put(p);
                    }
                }
                salida.put(c.trim(), vivos);
            }
            JSONObject logos = guardada.optJSONObject("logos"), misLogos = new JSONObject();
            if (logos != null) for (String c : canales) if (logos.has(c.trim())) misLogos.put(c.trim(), logos.getString(c.trim()));
            return new JSONObject().put("canales", salida).put("logos", misLogos)
                    .put("actualizada", guardada.optLong("actualizada") / 1000).toString();
        } catch (JSONException e) {
            return "{\"error\":\"guía dañada\"}";
        }
    }

    private static void descarga(Context ctx, File destino) {
        descargando = true;
        new Thread(() -> {
            HttpURLConnection con = null;
            try {
                con = (HttpURLConnection) new URL(URL_GUIA).openConnection();
                con.setConnectTimeout(15000);
                con.setReadTimeout(60000);
                Set<String> quiero;
                synchronized (pedidos) {
                    quiero = new HashSet<>(pedidos);
                }
                JSONObject canales = new JSONObject(), logos = new JSONObject();
                for (String c : quiero) canales.put(c, new JSONArray());
                try (InputStream in = new GZIPInputStream(new BufferedInputStream(con.getInputStream(), 65536))) {
                    lee(in, quiero, canales, logos);
                }
                JSONObject todo = new JSONObject().put("actualizada", System.currentTimeMillis())
                        .put("canales", canales).put("logos", logos);
                File tmp = new File(destino.getPath() + ".part");
                try (FileOutputStream out = new FileOutputStream(tmp)) {
                    out.write(todo.toString().getBytes(StandardCharsets.UTF_8));
                }
                if (!tmp.renameTo(destino)) {
                    destino.delete();
                    tmp.renameTo(destino);
                }
                error = null;
                Palabras.revisa(ctx); // guía nueva: busca los programas de los avisos automáticos
            } catch (Exception e) {
                error = "No se ha podido descargar la guía de TV";
            } finally {
                if (con != null) con.disconnect();
                descargando = false;
            }
        }, "guia").start();
    }

    private static void lee(InputStream in, Set<String> quiero, JSONObject canales, JSONObject logos) throws Exception {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyyMMddHHmmss Z", Locale.ROOT);
        long ahora = System.currentTimeMillis(), hasta = ahora + VENTANA;
        XmlPullParser x = Xml.newPullParser();
        x.setInput(in, "UTF-8");
        int ev;
        while ((ev = x.next()) != XmlPullParser.END_DOCUMENT) {
            if (ev != XmlPullParser.START_TAG) continue;
            if ("channel".equals(x.getName())) {
                // Logo del canal (picons_dobleM): <channel id><icon src/></channel>, al principio del archivo.
                String id = x.getAttributeValue(null, "id");
                int prof = x.getDepth();
                while (!((ev = x.next()) == XmlPullParser.END_TAG && x.getDepth() == prof)) {
                    if (ev == XmlPullParser.START_TAG && "icon".equals(x.getName()) && id != null && quiero.contains(id)) {
                        String src = x.getAttributeValue(null, "src");
                        if (src != null) logos.put(id, src);
                    }
                }
                continue;
            }
            if (!"programme".equals(x.getName())) continue;
            String canal = x.getAttributeValue(null, "channel");
            if (canal == null || !quiero.contains(canal)) continue;
            long ini, fin;
            try {
                ini = fmt.parse(x.getAttributeValue(null, "start")).getTime();
                fin = fmt.parse(x.getAttributeValue(null, "stop")).getTime();
            } catch (ParseException | NullPointerException e) {
                continue;
            }
            String titulo = "", cat = "";
            int prof = x.getDepth();
            while (!((ev = x.next()) == XmlPullParser.END_TAG && x.getDepth() == prof)) {
                if (ev != XmlPullParser.START_TAG) continue;
                if ("title".equals(x.getName()) && titulo.isEmpty()) titulo = x.nextText().trim();
                else if ("category".equals(x.getName()) && cat.isEmpty()) cat = x.nextText().trim();
            }
            if (fin <= ahora || ini >= hasta) continue;
            canales.getJSONArray(canal).put(new JSONObject()
                    .put("titulo", titulo).put("ini", ini / 1000).put("fin", fin / 1000).put("cat", cat));
        }
    }

    private static JSONObject lee(File f) {
        if (!f.isFile()) return null;
        try {
            return new JSONObject(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8));
        } catch (IOException | JSONException e) {
            return null;
        }
    }
}
