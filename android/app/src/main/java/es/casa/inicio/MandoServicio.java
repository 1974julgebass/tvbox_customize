package es.casa.inicio;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

/** Mantiene vivo el servidor del mando del móvil aunque se esté viendo otra app (servicio en primer plano). */
public class MandoServicio extends Service {

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("mando", "Mando del móvil", NotificationManager.IMPORTANCE_MIN));
        Notification n = new Notification.Builder(this, "mando")
                .setSmallIcon(R.drawable.icono)
                .setContentTitle("Mando del móvil activo")
                .build();
        startForeground(1, n);
        Servidor.arranca(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
