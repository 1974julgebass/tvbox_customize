package es.casa.inicio;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

/** Suena un aviso (o la caja acaba de encender): enseña la tarjeta flotante encima de lo que se esté viendo. */
public class AvisoReceptor extends BroadcastReceiver {

    private static final long DURA = 20_000;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        Context c = ctx.getApplicationContext();
        String accion = intent.getAction() != null ? intent.getAction() : "";
        switch (accion) {
            case Intent.ACTION_BOOT_COMPLETED:
                Avisos.reprograma(c);
                Temporizador.pon(c, 0); // un temporizador de antes de apagar ya no vale
                Temporizador.programaGuia(c);
                c.startForegroundService(new Intent(c, MandoServicio.class));
                return;
            case Temporizador.PREAVISO:
                tarjeta(c, "Temporizador", "La caja se apagará en 1 minuto", "Para seguir: Ajustes → Temporizador → Cancelar");
                return;
            case Temporizador.APAGAR:
                Temporizador.pon(c, 0);
                Accion.reposo();
                return;
            case Temporizador.GUIA:
                Guia.renueva(c);
                return;
            default:
                String id = intent.getStringExtra("id");
                JSONObject a = id != null ? Avisos.saca(c, id) : null;
                if (a == null) return;
                long faltan = Math.max(0, a.optLong("ini") - System.currentTimeMillis() / 1000);
                String cuando = faltan > 30 ? "Empieza en 1 minuto" : "Empieza ahora";
                tarjeta(c, cuando + " en " + a.optString("nombre"), a.optString("titulo"), "Ábrelo desde la pantalla de inicio");
        }
    }

    private static void tarjeta(Context c, String arriba, String titulo, String abajo) {
        tarjeta(c, arriba, titulo, abajo, DURA);
    }

    /** La misma tarjeta desde cualquier hilo (p. ej. el servidor del mando), durante `dura` ms. */
    static void muestra(Context c, String arriba, String titulo, String abajo, long dura) {
        new Handler(Looper.getMainLooper()).post(() -> tarjeta(c.getApplicationContext(), arriba, titulo, abajo, dura));
    }

    /** Tarjeta oscura arriba a la derecha; no coge el foco ni el mando. Necesita SYSTEM_ALERT_WINDOW. */
    private static void tarjeta(Context c, String arriba, String titulo, String abajo, long dura) {
        if (!Settings.canDrawOverlays(c)) return;
        WindowManager wm = (WindowManager) c.getSystemService(Context.WINDOW_SERVICE);
        if (wm == null) return;

        LinearLayout caja = new LinearLayout(c);
        caja.setOrientation(LinearLayout.VERTICAL);
        int p = dp(c, 22);
        caja.setPadding(p, dp(c, 18), p, dp(c, 18));
        GradientDrawable fondo = new GradientDrawable();
        fondo.setColor(0xF01C212A);
        fondo.setCornerRadius(dp(c, 18));
        fondo.setStroke(dp(c, 1), 0x33FFFFFF);
        caja.setBackground(fondo);

        caja.addView(texto(c, arriba, 13, 0xB3FFFFFF, false));
        caja.addView(texto(c, titulo, 20, 0xFFFFFFFF, true));
        caja.addView(texto(c, abajo, 12, 0x99FFFFFF, false));

        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                dp(c, 360), WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.END;
        lp.x = dp(c, 32);
        lp.y = dp(c, 28);
        try {
            wm.addView(caja, lp);
        } catch (RuntimeException e) {
            return;
        }
        new Handler(Looper.getMainLooper()).postDelayed(() -> quita(wm, caja), dura);
    }

    private static void quita(WindowManager wm, View v) {
        try {
            wm.removeView(v);
        } catch (RuntimeException ignorada) {
            // Ya no estaba.
        }
    }

    private static TextView texto(Context c, String s, int sp, int color, boolean negrita) {
        TextView t = new TextView(c);
        t.setText(s);
        t.setTextColor(color);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setMaxLines(2);
        if (negrita) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(0, dp(c, 2), 0, dp(c, 2));
        return t;
    }

    private static int dp(Context c, int v) {
        return Math.round(v * c.getResources().getDisplayMetrics().density);
    }
}
