# Configuración

Con la app instalada y puesta como pantalla de inicio (lo cuenta el [manual de instalación](01-instalacion.md)), toca dejarla a tu gusto. Casi todo se hace desde la propia tele con el mando, en **Ajustes**, la última tarjeta de la tercera fila.

![Ajustes](capturas/ajustes.png)

Debajo de los iconos verás una línea que explica qué hace el ajuste que tienes marcado. Los de apagar y reiniciar están al final a propósito, para no darles sin querer.

## Tus apps en la pantalla de inicio

La pantalla no enseña todas las apps: enseña las que tú elijas. Para añadir una:

1. Entra en **Todas las apps**.
2. Ponte encima de la que quieras y pulsa **OK**.
3. Elige **Añadir a la pantalla de inicio**.

![Todas las apps](capturas/todas-las-apps.png)

Las que ya están en la pantalla de inicio llevan un punto verde al lado del nombre.

Tú decides qué apps salen; dónde salen lo decide ella. Las que tienen algo que contar suben a la primera fila: las de televisión (RTVE Play, Atresplayer, Movistar+), porque enseñan su guía, y las que guardan lo último que viste. El resto se queda en la tercera fila, junto a Buscar, Todas y Ajustes.

Sobre cualquier app de la pantalla de inicio, **OK** abre su menú:

![Menú de una app](capturas/menu-app.png)

- **Abrir**: viene marcada, así que abrir una app es OK y OK.
- **Mover**: la app se levanta y la llevas con las flechas izquierda y derecha. OK para soltarla.
- **Quitar de la pantalla de inicio**: desaparece de aquí, pero sigue instalada.
- **Información de la app**: abre su ficha de Android, para forzar el cierre, borrar datos o desinstalar.

Desde **Todas las apps** también puedes **Ocultar** una app que no usas nunca y que no puedes desinstalar (las que vienen de fábrica). Pasa al final de la lista, en gris, y desde ahí la recuperas con **Volver a mostrar**.

## Ciudad del tiempo

**Ajustes → Ciudad.** Escribe el nombre con el teclado de la tele (o el micrófono del mando, si tiene) y elige la tuya de la lista. Busca primero en España, pero vale cualquier ciudad del mundo.

![Elegir ciudad](capturas/ciudad.png)

El tiempo, la salida y puesta del sol y las horas de la luna pasan a ser los de esa ciudad, en su hora local.

## Avisos automáticos

Si sigues a un equipo o una serie, apúntalo aquí y la caja te avisa cuando lo echen en alguno de tus canales.

**Ajustes → Avisos automáticos.** Pulsa OK en la caja de texto, escribe la palabra y OK otra vez. Para quitar una, ponte encima y OK.

![Avisos automáticos](capturas/avisos-automaticos.png)

Cómo funciona:

- Busca en la guía de los canales de las apps de televisión que tengas instaladas.
- Da igual escribir con tildes o sin ellas, en mayúsculas o en minúsculas.
- Revisa la guía cada seis horas, aunque no abras la pantalla de inicio.
- Un minuto antes de que empiece, sale un aviso en una esquina de la pantalla, estés viendo lo que estés viendo.

Pon palabras concretas. «Madrid» te avisará de cada telediario; «Real Madrid» solo de los partidos.

## Temporizador

**Ajustes → Temporizador** apaga la caja dentro de 30 minutos, 1 hora, 1 hora y media o 2 horas. Mientras está en marcha, al lado de la hora aparece una píldora naranja con el tiempo que queda.

![Temporizador](capturas/temporizador.png)

Un minuto antes te avisa en pantalla. Si quieres seguir viendo, vuelve a **Temporizador** y elige **Cancelar temporizador**.

«Apagar» aquí es dejar la caja en reposo, igual que el botón de encendido del mando. Se enciende con el mando.

## Usar el móvil como mando

Cualquier móvil de casa puede hacer de mando: cruceta, volumen, escribir con el teclado del móvil (comodísimo para buscar o meter contraseñas), abrir apps e instalar APK. No hace falta instalar nada en el móvil: es una página web que sirve la propia caja.

1. En la tele, **Ajustes → Usar el móvil**. Sale un código QR.
2. Ábrelo con la cámara del móvil y toca el enlace.
3. Listo. Guarda la página en la pantalla de inicio del móvil para tenerla a mano.

![Emparejar el móvil](capturas/emparejar-movil.png)

El código sirve una sola vez y caduca a los cinco minutos. El móvil queda emparejado hasta que lo quites.

**La primera vez** que uses el mando del móvil, la tele preguntará **«¿Permitir la depuración USB?»**. Es la caja pidiéndose permiso a sí misma para pulsar teclas. Marca *Permitir siempre* y acepta; no volverá a salir.

Para ver qué móviles están emparejados, o quitar uno (por ejemplo, el de una visita), entra en **Ajustes → Móviles emparejados** y pulsa OK sobre él.

![Móviles emparejados](capturas/moviles-emparejados.png)

Ten en cuenta dos cosas:

- El móvil tiene que estar en la misma wifi que la caja.
- Con la caja en reposo se apaga su wifi, así que el móvil no puede encenderla. Para eso, el mando de siempre.

## Salvapantallas

Si diste el permiso del salvapantallas en la instalación, cuando la caja lleva un rato sin usarse aparece una pantalla con la hora grande, el tiempo, lo que echan en tus canales, la luna y los avisos que tengas pendientes.

![Salvapantallas](capturas/salvapantallas.png)

Se desplaza unos píxeles cada minuto para no marcar la pantalla. Cuánto tarda en salir lo eliges en los ajustes de Android (**Ajustes → Ajustes de Android → Preferencias del dispositivo → Salvapantallas**) o desde el panel del PC.

## Modo noche

De 11 de la noche a 7 de la mañana la pantalla se oscurece un poco para no deslumbrar con la luz apagada. Se activa sola; no hay nada que configurar.

## Canales de la guía

La guía de televisión sale de la programación pública de [EPG_dobleM](https://github.com/davidmuma/EPG_dobleM), que cubre los canales de España. La caja la descarga cada seis horas.

Cada app de televisión tiene sus canales asignados en `launcher/js/home.js`, al principio del archivo:

```js
const CANALES = {
  'com.rtve.androidtv': ['La 1 HD', 'La 2', '24 Horas', 'Clan', 'Teledeporte'],
  'com.antena3.atresplayer.tv': ['Antena 3 HD', 'La Sexta HD', 'Neox', 'Nova', 'Mega', 'Atreseries'],
  ...
};
```

Y la tarjeta **En directo** junta los de `PRINCIPALES`, en ese orden. Si quieres otros canales, cámbialos ahí (con el nombre exacto que usa la guía) y vuelve a compilar e instalar.

Atresplayer abre el directo del canal elegido. RTVE Play y Movistar+ abren la app, sin entrar en el canal: no he encontrado cómo pedirles un canal concreto desde fuera. La primera vez que abras un directo de Atresplayer, la app te pedirá aceptar sus cookies.

## Desde el panel del PC

Si montaste el panel, en su sección **Ajustes** cambias tres cosas de Android que desde la tele están más escondidas:

- **Animaciones**: más rápidas o desactivadas. En una caja modesta, a 0,5× se nota más ágil.
- **Salvapantallas**: tras cuánto tiempo sale.
- **Suspensión**: tras cuánto tiempo sin usarla se apaga la caja.

## Limpiar lo que trae de fábrica (opcional)

Las cajas suelen traer apps de publicidad, estadísticas y recomendaciones que no aportan nada. Puedes desactivarlas desde el PC sin desinstalar nada, así que siempre hay vuelta atrás. Estas son las que desactivé yo en la Mi Box 4:

```powershell
adb shell pm disable-user --user 0 tv.alphonso.alphonso_eula
adb shell pm disable-user --user 0 com.miui.tv.analytics
adb shell pm disable-user --user 0 com.mitv.tvhome.michannel
adb shell pm disable-user --user 0 com.google.android.tvrecommendations
adb shell pm disable-user --user 0 com.google.android.feedback
adb shell pm disable-user --user 0 com.google.android.tv.bugreportsender
```

Para recuperar una: `adb shell pm enable <paquete>`.

No toques los servicios de Google (`com.google.android.gms`, `com.google.android.gsf`, `com.android.vending`), ni `com.google.android.tungsten.setupwraith` (puede borrar la wifi guardada), ni nada que tenga que ver con el mando o con Chromecast. Si dudas de un paquete, déjalo como está.
