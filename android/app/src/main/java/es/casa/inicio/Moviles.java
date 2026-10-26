package es.casa.inicio;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Móviles emparejados con el mando: solo con el QR de la tele, sin contraseña y sin caducidad (se quitan a mano).
 * El QR lleva un código de un solo uso que caduca a los 5 minutos; al canjearlo el móvil recibe una cookie larga cuyo
 * hash se guarda aquí.
 */
final class Moviles {

    static final String COOKIE = "mando";
    private static final long VIDA_CODIGO = 5 * 60 * 1000;
    private static final SecureRandom azar = new SecureRandom();
    private static final List<long[]> caducidades = new ArrayList<>();
    private static final List<String> codigos = new ArrayList<>(); // hashes, en paralelo con caducidades

    private Moviles() {
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("inicio", Context.MODE_PRIVATE);
    }

    static String aleatorio(int bytes) {
        byte[] b = new byte[bytes];
        azar.nextBytes(b);
        return Base64.encodeToString(b, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    static String hash(String s) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            return Base64.encodeToString(h, Base64.NO_WRAP);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Código nuevo para el QR. */
    static synchronized String codigoNuevo() {
        purga();
        // 12 bytes (96 bits): de sobra para un código que caduca a los 5 minutos y se gasta al usarlo, y deja el QR corto.
        String codigo = aleatorio(12);
        codigos.add(hash(codigo));
        caducidades.add(new long[]{System.currentTimeMillis() + VIDA_CODIGO});
        return codigo;
    }

    /** Gasta el código: true si valía. */
    static synchronized boolean canjea(String codigo) {
        purga();
        int i = codigos.indexOf(hash(codigo));
        if (i < 0) return false;
        codigos.remove(i);
        caducidades.remove(i);
        return true;
    }

    private static void purga() {
        long ahora = System.currentTimeMillis();
        for (int i = codigos.size() - 1; i >= 0; i--) {
            if (caducidades.get(i)[0] < ahora) {
                codigos.remove(i);
                caducidades.remove(i);
            }
        }
    }

    static synchronized JSONArray lista(Context c) {
        try {
            return new JSONArray(prefs(c).getString("moviles", "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** Da de alta un móvil y devuelve el token de su cookie. */
    static synchronized String alta(Context c, String nombre) {
        String token = aleatorio(32);
        JSONArray l = lista(c);
        try {
            l.put(new JSONObject().put("id", aleatorio(6)).put("nombre", nombre)
                    .put("hash", hash(token)).put("creado", System.currentTimeMillis()));
        } catch (JSONException ignorada) {
            // No pasa con estos tipos.
        }
        prefs(c).edit().putString("moviles", l.toString()).commit(); // al momento: que una reinstalación no lo pierda
        return token;
    }

    static synchronized boolean valido(Context c, String token) {
        if (token == null || token.isEmpty()) return false;
        String h = hash(token);
        JSONArray l = lista(c);
        for (int i = 0; i < l.length(); i++) {
            if (MessageDigest.isEqual(h.getBytes(StandardCharsets.UTF_8),
                    l.optJSONObject(i).optString("hash").getBytes(StandardCharsets.UTF_8))) return true;
        }
        return false;
    }

    static synchronized void quita(Context c, String id) {
        JSONArray l = lista(c), quedan = new JSONArray();
        for (int i = 0; i < l.length(); i++) if (!id.equals(l.optJSONObject(i).optString("id"))) quedan.put(l.opt(i));
        prefs(c).edit().putString("moviles", quedan.toString()).commit();
    }

    /** Para la pantalla de inicio: sin los hashes. */
    static JSONArray publica(Context c) {
        JSONArray l = lista(c), out = new JSONArray();
        for (int i = 0; i < l.length(); i++) {
            JSONObject o = l.optJSONObject(i), p = new JSONObject();
            for (Iterator<String> it = o.keys(); it.hasNext(); ) {
                String k = it.next();
                if (!"hash".equals(k)) {
                    try {
                        p.put(k, o.get(k));
                    } catch (JSONException ignorada) {
                        // No pasa.
                    }
                }
            }
            out.put(p);
        }
        return out;
    }

    /** Nombre legible del móvil a partir de su navegador. */
    static String nombre(String ua) {
        if (ua == null) return "Móvil";
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("Android [\\d.]+; ([^;)]+)").matcher(ua);
        if (m.find() && !m.group(1).trim().equals("K")) return m.group(1).trim();
        if (ua.contains("iPhone")) return "iPhone";
        if (ua.contains("iPad")) return "iPad";
        if (ua.contains("Android")) return "Móvil Android";
        return "Móvil";
    }
}
