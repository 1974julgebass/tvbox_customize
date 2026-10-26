package es.casa.inicio;

import android.content.Context;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Banner de cada app (el rectángulo que usa Android TV) guardado como PNG en files/banners para que la página
 * lo cargue con file://, y un color propio de la app sacado de su icono para el fondo y la luz ambiente.
 */
final class Iconos {

    static final class Imagen {
        String banner;
        String color;
    }

    private static final Map<String, Imagen> memoria = new HashMap<>();

    private Iconos() {
    }

    static synchronized Imagen de(Context ctx, PackageManager pm, ActivityInfo ai) {
        String pkg = ai.packageName;
        long version;
        try {
            version = pm.getPackageInfo(pkg, 0).lastUpdateTime;
        } catch (PackageManager.NameNotFoundException e) {
            version = 0;
        }
        String clave = pkg + "@" + version;
        Imagen ya = memoria.get(clave);
        if (ya != null) return ya;

        Imagen img = new Imagen();
        File dir = new File(ctx.getFilesDir(), "banners");
        if (!dir.isDirectory()) dir.mkdirs();
        File png = new File(dir, pkg + "-" + version + ".png");

        Drawable banner = ai.loadBanner(pm);
        if (banner == null) banner = ai.applicationInfo.loadBanner(pm);
        if (banner != null) {
            Bitmap b = aBitmap(banner, 320, 180);
            if (!png.exists()) guarda(b, png);
            img.banner = "file://" + png.getAbsolutePath();
            img.color = colorDe(b);
        } else {
            img.color = colorDe(aBitmap(ai.loadIcon(pm), 96, 96));
        }
        memoria.put(clave, img);
        return img;
    }

    static Bitmap aBitmap(Drawable d, int anchoDef, int altoDef) {
        int w = d.getIntrinsicWidth() > 0 ? d.getIntrinsicWidth() : anchoDef;
        int h = d.getIntrinsicHeight() > 0 ? d.getIntrinsicHeight() : altoDef;
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        d.setBounds(0, 0, w, h);
        d.draw(c);
        return b;
    }

    static void guarda(Bitmap b, File f) {
        try (FileOutputStream out = new FileOutputStream(f)) {
            b.compress(Bitmap.CompressFormat.PNG, 100, out);
        } catch (IOException ignorada) {
            // Sin banner en disco: la página pinta el color con el nombre.
        }
    }

    /** Color medio de los píxeles con color, llevado a un tono con buen contraste para texto blanco. */
    private static String colorDe(Bitmap src) {
        Bitmap b = Bitmap.createScaledBitmap(src, 24, 24, true);
        long r = 0, g = 0, bl = 0, n = 0;
        float[] hsv = new float[3];
        for (int y = 0; y < 24; y++) {
            for (int x = 0; x < 24; x++) {
                int p = b.getPixel(x, y);
                if (Color.alpha(p) < 128) continue;
                Color.colorToHSV(p, hsv);
                // Los grises y blancos del logo no cuentan: buscamos el color de marca.
                int peso = hsv[1] > .25f && hsv[2] > .2f ? 4 : 1;
                r += (long) Color.red(p) * peso;
                g += (long) Color.green(p) * peso;
                bl += (long) Color.blue(p) * peso;
                n += peso;
            }
        }
        if (n == 0) return "#3A4458";
        Color.RGBToHSV((int) (r / n), (int) (g / n), (int) (bl / n), hsv);
        hsv[1] = Math.max(hsv[1], .45f);
        hsv[2] = Math.min(Math.max(hsv[2], .45f), .72f);
        return String.format("#%06X", 0xFFFFFF & Color.HSVToColor(hsv));
    }
}
