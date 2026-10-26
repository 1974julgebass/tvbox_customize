package es.casa.inicio;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

/**
 * Temporizador de apagado: a la hora pone la caja en reposo (servicio Accion). Un minuto antes enseña un aviso.
 * Y la revisión periódica de la guía (cada 6 h) para los avisos automáticos, que vive aquí por ser otra alarma.
 */
final class Temporizador {

    static final String APAGAR = "es.casa.inicio.APAGAR";
    static final String PREAVISO = "es.casa.inicio.PREAVISO";
    static final String GUIA = "es.casa.inicio.GUIA";

    private Temporizador() {
    }

    /** minutos 0 = cancelar. */
    static void pon(Context c, int minutos) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.cancel(pi(c, APAGAR));
        am.cancel(pi(c, PREAVISO));
        if (minutos <= 0) {
            c.getSharedPreferences("inicio", Context.MODE_PRIVATE).edit().remove("apagado").apply();
            return;
        }
        long fin = System.currentTimeMillis() + minutos * 60_000L;
        c.getSharedPreferences("inicio", Context.MODE_PRIVATE).edit().putLong("apagado", fin).apply();
        programa(am, fin, pi(c, APAGAR));
        if (minutos > 1) programa(am, fin - 60_000, pi(c, PREAVISO));
    }

    static long fin(Context c) {
        long f = c.getSharedPreferences("inicio", Context.MODE_PRIVATE).getLong("apagado", 0);
        return f > System.currentTimeMillis() ? f : 0;
    }

    /** Revisión de la guía cada 6 h (inexacta, gasta poco). */
    static void programaGuia(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.setInexactRepeating(AlarmManager.RTC, System.currentTimeMillis() + AlarmManager.INTERVAL_HOUR,
                6 * AlarmManager.INTERVAL_HOUR, pi(c, GUIA));
    }

    private static void programa(AlarmManager am, long cuando, PendingIntent pi) {
        try {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
        } catch (SecurityException sinPermiso) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
        }
    }

    private static PendingIntent pi(Context c, String accion) {
        Intent i = new Intent(c, AvisoReceptor.class).setAction(accion);
        return PendingIntent.getBroadcast(c, accion.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
