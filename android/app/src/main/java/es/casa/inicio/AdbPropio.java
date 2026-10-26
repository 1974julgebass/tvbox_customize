package es.casa.inicio;

import android.content.Context;

import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import dadb.AdbKeyPair;
import dadb.Dadb;

/**
 * La caja conectada a su propio ADB (127.0.0.1:5555) para pulsar teclas y escribir en cualquier app, que es lo que
 * una app normal no puede hacer. La primera vez Android pregunta en la tele «¿Permitir depuración?»; se acepta una
 * vez («Permitir siempre») y queda la clave en files/adb. Todo va en un solo hilo, en orden.
 */
final class AdbPropio {

    private static final ExecutorService hilo = Executors.newSingleThreadExecutor();
    private static Dadb adb;
    private static volatile String estado = "sin conectar";

    private AdbPropio() {
    }

    static String estado() {
        return estado;
    }

    /** Conecta en segundo plano (si hace falta, saldrá en la tele el aviso de permitir la depuración). */
    static void prepara(Context c) {
        hilo.execute(() -> conecta(c.getApplicationContext()));
    }

    /** Ejecuta una orden de shell en la caja, en orden y sin bloquear al que llama. */
    static void ejecuta(Context c, String orden) {
        Context app = c.getApplicationContext();
        hilo.execute(() -> {
            for (int intento = 0; intento < 2; intento++) {
                if (!conecta(app)) return;
                try {
                    adb.shell(orden);
                    return;
                } catch (Exception e) {
                    cierra(); // conexión caída (reinicio de adbd…): se reintenta una vez
                }
            }
        });
    }

    /** Orden de shell esperando a que termine (para lo que hay que tener hecho antes de seguir). Null si falla. */
    static String ejecutaYEspera(Context c, String orden) {
        Context app = c.getApplicationContext();
        try {
            return hilo.submit(() -> {
                if (!conecta(app)) return null;
                try {
                    return adb.shell(orden).getAllOutput();
                } catch (Exception e) {
                    cierra();
                    return null;
                }
            }).get();
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Instala (o actualiza) un APK sin el diálogo de Android. Bloquea hasta acabar: null si fue bien; si no, el texto
     * de Android (INSTALL_FAILED_…) o SIN_ADB si la caja aún no tiene permiso de depuración.
     * Va por una conexión propia (instalar tarda y no debe parar el mando) y como el `adb install` clásico: copiar a
     * /data/local/tmp, `pm install` y borrar. El `install()` de dadb manda el archivo por el canal de ADB y con APK
     * grandes (116 MB) se quedaba colgado; y en Android 9 el sistema no puede leer del almacenamiento compartido.
     * El archivo tiene que estar donde lo lea el shell (almacenamiento compartido, no la carpeta privada).
     */
    static String instala(Context c, File apk) {
        File dir = new File(c.getFilesDir(), "adb");
        File priv = new File(dir, "adbkey"), pub = new File(dir, "adbkey.pub");
        if (!priv.isFile()) {
            prepara(c);
            return "SIN_ADB";
        }
        try (Dadb propia = Dadb.Companion.create("127.0.0.1", 5555, AdbKeyPair.Companion.read(priv, pub))) {
            String ruta = apk.getAbsolutePath().replace("'", "'\\''");
            String tmp = "/data/local/tmp/inicio-instalar.apk";
            String salida = propia.shell("cp '" + ruta + "' " + tmp + " && pm install -r " + tmp + "; rm -f " + tmp)
                    .getAllOutput().trim();
            return salida.contains("Success") ? null : salida;
        } catch (Exception e) {
            return "SIN_ADB";
        }
    }

    private static boolean conecta(Context c) {
        if (adb != null) return true;
        try {
            File dir = new File(c.getFilesDir(), "adb");
            File priv = new File(dir, "adbkey"), pub = new File(dir, "adbkey.pub");
            if (!priv.isFile()) {
                dir.mkdirs();
                AdbKeyPair.Companion.generate(priv, pub);
            }
            estado = "esperando permiso";
            adb = Dadb.Companion.create("127.0.0.1", 5555, AdbKeyPair.Companion.read(priv, pub));
            adb.shell("echo ok");
            estado = "conectado";
            return true;
        } catch (Exception e) {
            cierra();
            estado = "sin ADB: " + e.getClass().getSimpleName();
            return false;
        }
    }

    private static void cierra() {
        try {
            if (adb != null) adb.close();
        } catch (Exception ignorada) {
            // Ya estaba cerrada.
        }
        adb = null;
    }
}
