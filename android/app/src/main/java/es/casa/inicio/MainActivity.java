package es.casa.inicio;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Pantalla de inicio: un WebView a pantalla completa con la interfaz de assets/www (copiada de tvbox/launcher)
 * y el puente TVHome para los datos de la caja. El mando llega a la web como teclas (flechas e Intro).
 */
public class MainActivity extends Activity {

    private WebView web;
    private boolean cargada;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        // Permite inspeccionar la página desde chrome://inspect en el PC (misma wifi + ADB).
        WebView.setWebContentsDebuggingEnabled(true);

        web = new WebView(this);
        web.setBackgroundColor(0xFF05070B);
        web.setFocusable(true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        // La página es local (file://) y pide el tiempo a Open-Meteo y lee los banners guardados en files/.
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new Puente(this), "TVHome");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String url) {
                cargada = true;
            }
        });
        setContentView(web);
        Temporizador.programaGuia(this); // revisión de la guía cada 6 h para los avisos automáticos
        startForegroundService(new Intent(this, MandoServicio.class)); // servidor del mando del móvil
        web.loadUrl("file:///android_asset/www/index.html");
        web.requestFocus();
    }

    @Override
    protected void onResume() {
        super.onResume();
        vuelve();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        vuelve();
    }

    /** Al volver de una app: la página refresca usos, historial y estado. */
    private void vuelve() {
        if (cargada) {
            web.evaluateJavascript("window.homeVuelve && homeVuelve()", null);
        }
    }

    /** El botón ☰ del mando abre el menú de la app enfocada (la página lo recibe como ContextMenu). */
    @Override
    public boolean onKeyDown(int codigo, KeyEvent ev) {
        if (codigo == KeyEvent.KEYCODE_MENU) {
            web.evaluateJavascript("dispatchEvent(new KeyboardEvent('keydown', {key: 'ContextMenu'}))", null);
            return true;
        }
        return super.onKeyDown(codigo, ev);
    }

    /** Atrás nunca sale de la pantalla de inicio: se lo pasa a la página como tecla GoBack. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("dispatchEvent(new KeyboardEvent('keydown', {key: 'GoBack'}))", null);
    }
}
