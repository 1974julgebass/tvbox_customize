package es.casa.inicio;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.Normalizer;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

/**
 * Avisos automáticos: {palabras: ["real madrid", ...], canales: {canal: pkg}}. Cada vez que hay guía nueva se buscan
 * esas palabras en los títulos (sin tildes ni mayúsculas) y se ponen avisos para lo que encaje y aún no haya empezado.
 */
final class Palabras {

    private Palabras() {
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("inicio", Context.MODE_PRIVATE);
    }

    static String config(Context c) {
        return prefs(c).getString("palabras", "{\"palabras\":[],\"canales\":{}}");
    }

    static void guarda(Context c, String json) throws JSONException {
        new JSONObject(json); // valida
        prefs(c).edit().putString("palabras", json).apply();
        revisa(c);
    }

    /** Canales que hay que tener en la guía para poder buscar las palabras. */
    static Set<String> canales(Context c) {
        Set<String> s = new HashSet<>();
        try {
            JSONObject canales = new JSONObject(config(c)).optJSONObject("canales");
            if (canales != null) for (Iterator<String> it = canales.keys(); it.hasNext(); ) s.add(it.next());
        } catch (JSONException ignorada) {
            // Sin configuración válida no hay canales.
        }
        return s;
    }

    static String normal(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase();
    }

    static synchronized void revisa(Context c) {
        try {
            JSONObject cfg = new JSONObject(config(c));
            JSONArray palabras = cfg.optJSONArray("palabras");
            JSONObject pkgs = cfg.optJSONObject("canales");
            File f = new File(c.getFilesDir(), "guia.json");
            if (palabras == null || palabras.length() == 0 || pkgs == null || !f.isFile()) return;
            JSONObject guia = new JSONObject(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8)).optJSONObject("canales");
            if (guia == null) return;

            Set<String> ya = new HashSet<>();
            JSONArray avisos = Avisos.lista(c);
            for (int i = 0; i < avisos.length(); i++) ya.add(avisos.getJSONObject(i).optString("id"));

            long ahora = System.currentTimeMillis() / 1000;
            for (Iterator<String> it = guia.keys(); it.hasNext(); ) {
                String canal = it.next();
                if (!pkgs.has(canal)) continue;
                JSONArray progs = guia.getJSONArray(canal);
                for (int i = 0; i < progs.length(); i++) {
                    JSONObject p = progs.getJSONObject(i);
                    if (p.optLong("ini") <= ahora + 60) continue;
                    String titulo = normal(p.optString("titulo"));
                    for (int k = 0; k < palabras.length(); k++) {
                        String palabra = palabras.optString(k);
                        if (palabra.isEmpty() || !titulo.contains(normal(palabra))) continue;
                        String id = canal + "|" + p.optLong("ini");
                        if (ya.add(id)) {
                            Avisos.pon(c, new JSONObject().put("id", id).put("canal", canal)
                                    .put("nombre", canal.replaceAll(" HD$", "")).put("titulo", p.optString("titulo"))
                                    .put("ini", p.optLong("ini")).put("pkg", pkgs.optString(canal)).put("auto", palabra).toString());
                        }
                        break;
                    }
                }
            }
        } catch (Exception ignorada) {
            // Guía o configuración rota: se reintenta con la siguiente guía.
        }
    }
}
