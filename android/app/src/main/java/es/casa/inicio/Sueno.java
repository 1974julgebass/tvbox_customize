package es.casa.inicio;

import android.service.dreams.DreamService;
import android.webkit.WebSettings;
import android.webkit.WebView;

/**
 * Salvapantallas propio: assets/www/sueno.html (hora, tiempo y lo que echan en tus canales, moviéndose muy despacio).
 * Se elige por ADB: settings put secure screensaver_components es.casa.inicio/es.casa.inicio.Sueno
 */
public class Sueno extends DreamService {

    private WebView web;

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false);
        setFullscreen(true);
        web = new WebView(this);
        web.setBackgroundColor(0xFF000000);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        web.addJavascriptInterface(new Puente(this), "TVHome");
        setContentView(web);
        web.loadUrl("file:///android_asset/www/sueno.html");
    }

    @Override
    public void onDetachedFromWindow() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDetachedFromWindow();
    }
}
