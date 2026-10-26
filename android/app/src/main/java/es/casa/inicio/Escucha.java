package es.casa.inicio;

import android.content.ComponentName;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.SystemClock;
import android.service.notification.NotificationListenerService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Escucha las sesiones multimedia de las apps (lo que está sonando) y apunta título y progreso en el Historial.
 * Necesita ser «oyente de notificaciones», que se concede por ADB; no lee las notificaciones en sí.
 */
public class Escucha extends NotificationListenerService implements MediaSessionManager.OnActiveSessionsChangedListener {

    private static final long CADA = 15000;

    private MediaSessionManager msm;
    private final Map<MediaController, MediaController.Callback> oidos = new HashMap<>();
    private final Map<String, Long> ultimaVez = new HashMap<>();

    @Override
    public void onListenerConnected() {
        msm = getSystemService(MediaSessionManager.class);
        ComponentName yo = new ComponentName(this, Escucha.class);
        try {
            msm.addOnActiveSessionsChangedListener(this, yo);
            onActiveSessionsChanged(msm.getActiveSessions(yo));
        } catch (SecurityException sinPermiso) {
            // Sin acceso de oyente: no hay historial, la pantalla sigue funcionando.
        }
    }

    @Override
    public void onListenerDisconnected() {
        if (msm != null) msm.removeOnActiveSessionsChangedListener(this);
        for (Map.Entry<MediaController, MediaController.Callback> e : oidos.entrySet()) {
            e.getKey().unregisterCallback(e.getValue());
        }
        oidos.clear();
    }

    @Override
    public void onActiveSessionsChanged(List<MediaController> controles) {
        if (controles == null) return;
        for (MediaController c : controles) {
            boolean ya = false;
            for (MediaController o : oidos.keySet()) ya |= o.getSessionToken().equals(c.getSessionToken());
            if (ya) continue;
            MediaController.Callback cb = new MediaController.Callback() {
                @Override
                public void onMetadataChanged(MediaMetadata m) {
                    apunta(c, true);
                }

                @Override
                public void onPlaybackStateChanged(PlaybackState s) {
                    apunta(c, false);
                }

                @Override
                public void onSessionDestroyed() {
                    apunta(c, true);
                    c.unregisterCallback(this);
                    oidos.remove(c);
                }
            };
            c.registerCallback(cb);
            oidos.put(c, cb);
            apunta(c, true);
        }
    }

    /** Apunta lo que suena; los cambios de posición, como mucho cada 15 s por app. */
    private void apunta(MediaController c, boolean siempre) {
        MediaMetadata m = c.getMetadata();
        if (m == null) return;
        String titulo = texto(m, MediaMetadata.METADATA_KEY_DISPLAY_TITLE, MediaMetadata.METADATA_KEY_TITLE);
        if (titulo.isEmpty()) return;
        String pkg = c.getPackageName();
        long ahora = SystemClock.elapsedRealtime();
        Long antes = ultimaVez.get(pkg);
        if (!siempre && antes != null && ahora - antes < CADA) return;
        ultimaVez.put(pkg, ahora);

        String sub = texto(m, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_ALBUM);
        long dur = m.getLong(MediaMetadata.METADATA_KEY_DURATION);
        PlaybackState s = c.getPlaybackState();
        double progreso = -1;
        if (dur > 0 && s != null && s.getPosition() >= 0) {
            long pos = s.getPosition();
            if (s.getState() == PlaybackState.STATE_PLAYING) {
                pos += (long) ((SystemClock.elapsedRealtime() - s.getLastPositionUpdateTime()) * s.getPlaybackSpeed());
            }
            progreso = Math.min(1, Math.max(0, (double) pos / dur));
        }
        Historial.apunta(this, pkg, titulo, sub, progreso);
    }

    private static String texto(MediaMetadata m, String... claves) {
        for (String k : claves) {
            CharSequence v = m.getText(k);
            if (v != null && v.toString().trim().length() > 0) return v.toString().trim();
        }
        return "";
    }
}
