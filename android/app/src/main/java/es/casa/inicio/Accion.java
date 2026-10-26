package es.casa.inicio;

import android.accessibilityservice.AccessibilityService;
import android.os.Build;
import android.view.accessibility.AccessibilityEvent;

/**
 * Servicio de accesibilidad mínimo: no lee la pantalla ni recibe eventos útiles; solo existe para dos acciones
 * globales que una app normal no puede hacer: abrir el menú de apagado (el del botón de encendido) y el reposo.
 * Se activa por ADB (ver CLAUDE.md del proyecto).
 */
public class Accion extends AccessibilityService {

    private static volatile Accion activo;

    @Override
    protected void onServiceConnected() {
        activo = this;
    }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        activo = null;
        return super.onUnbind(intent);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        // No hace nada con los eventos.
    }

    @Override
    public void onInterrupt() {
    }

    static boolean disponible() {
        return activo != null;
    }

    /** Menú del sistema con Reiniciar y Apagar. */
    static boolean menuApagado() {
        Accion a = activo;
        return a != null && a.performGlobalAction(GLOBAL_ACTION_POWER_DIALOG);
    }

    /** Apaga la pantalla (reposo); el mando la despierta. */
    static boolean reposo() {
        Accion a = activo;
        return a != null && Build.VERSION.SDK_INT >= 28 && a.performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN);
    }
}
