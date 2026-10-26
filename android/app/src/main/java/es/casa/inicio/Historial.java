package es.casa.inicio;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** Lo último visto en cada app: {pkg: [{titulo, sub, ts, progreso}]}, lo más reciente primero, 8 por app. */
final class Historial {

    private static final int MAX = 8;

    private Historial() {
    }

    static synchronized JSONArray de(Context ctx, String pkg) {
        JSONArray a = carga(ctx).optJSONArray(pkg);
        return a != null ? a : new JSONArray();
    }

    /** progreso: 0..1, o -1 si la app no dice la duración. */
    static synchronized void apunta(Context ctx, String pkg, String titulo, String sub, double progreso) {
        JSONObject todo = carga(ctx);
        try {
            JSONArray viejo = todo.optJSONArray(pkg), nuevo = new JSONArray();
            nuevo.put(new JSONObject().put("titulo", titulo).put("sub", sub)
                    .put("ts", System.currentTimeMillis()).put("progreso", progreso));
            if (viejo != null) {
                for (int i = 0; i < viejo.length() && nuevo.length() < MAX; i++) {
                    JSONObject h = viejo.getJSONObject(i);
                    if (!titulo.equals(h.optString("titulo"))) nuevo.put(h);
                }
            }
            todo.put(pkg, nuevo);
            File f = archivo(ctx), tmp = new File(f.getPath() + ".part");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(todo.toString().getBytes(StandardCharsets.UTF_8));
            }
            if (!tmp.renameTo(f)) {
                f.delete();
                tmp.renameTo(f);
            }
        } catch (JSONException | IOException ignorada) {
            // Si no se puede apuntar, se pierde esta entrada y nada más.
        }
    }

    private static File archivo(Context ctx) {
        return new File(ctx.getFilesDir(), "historial.json");
    }

    private static JSONObject carga(Context ctx) {
        File f = archivo(ctx);
        if (f.isFile()) {
            try {
                return new JSONObject(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8));
            } catch (IOException | JSONException ignorada) {
                // Archivo roto: se empieza de cero.
            }
        }
        return new JSONObject();
    }
}
