package es.casa.inicio;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Avisos de programas de la guía: [{id, canal, nombre, titulo, ini (s), pkg}] en SharedPreferences.
 * Cada uno tiene una alarma un minuto antes de empezar; al sonar, AvisoReceptor enseña la tarjeta flotante.
 */
final class Avisos {

    private static final String CLAVE = "avisos";

    private Avisos() {
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("inicio", Context.MODE_PRIVATE);
    }

    static synchronized JSONArray lista(Context c) {
        try {
            return new JSONArray(prefs(c).getString(CLAVE, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void guarda(Context c, JSONArray a) {
        prefs(c).edit().putString(CLAVE, a.toString()).apply();
    }

    static synchronized void pon(Context c, String json) throws JSONException {
        JSONObject nuevo = new JSONObject(json);
        String id = nuevo.getString("id");
        JSONArray a = lista(c), b = new JSONArray();
        for (int i = 0; i < a.length(); i++) if (!id.equals(a.getJSONObject(i).optString("id"))) b.put(a.get(i));
        b.put(nuevo);
        guarda(c, b);
        programa(c, nuevo);
    }

    /** Quita el aviso y lo devuelve (null si no estaba). */
    static synchronized JSONObject saca(Context c, String id) {
        JSONArray a = lista(c), b = new JSONArray();
        JSONObject sacado = null;
        for (int i = 0; i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            if (o == null) continue;
            if (id.equals(o.optString("id"))) sacado = o;
            else b.put(o);
        }
        guarda(c, b);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(alarma(c, id));
        return sacado;
    }

    /** Tras encender la caja: vuelve a poner las alarmas y tira las que ya pasaron. */
    static synchronized void reprograma(Context c) {
        JSONArray a = lista(c), b = new JSONArray();
        long ahora = System.currentTimeMillis() / 1000;
        for (int i = 0; i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            if (o == null || o.optLong("ini") < ahora) continue;
            b.put(o);
            programa(c, o);
        }
        guarda(c, b);
    }

    private static void programa(Context c, JSONObject a) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long cuando = Math.max(System.currentTimeMillis() + 1000, a.optLong("ini") * 1000 - 60_000);
        try {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, alarma(c, a.optString("id")));
        } catch (SecurityException sinPermiso) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, alarma(c, a.optString("id")));
        }
    }

    private static PendingIntent alarma(Context c, String id) {
        Intent i = new Intent(c, AvisoReceptor.class).setAction("es.casa.inicio.AVISO").putExtra("id", id);
        return PendingIntent.getBroadcast(c, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
