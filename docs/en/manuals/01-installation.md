# Installation

This guide takes you from an Android TV box fresh out of its packaging to the new home screen up and running. I set it up on a Xiaomi Mi Box 4 (Android TV 9), so the menu names are the ones on that box. Other brands word things a little differently, but the steps are the same.

Allow about an hour the first time. Most of it goes into installing the tools on the PC; the box itself takes ten minutes.

![The home screen running](../../manuales/capturas/inicio.png)

The app's interface is in Spanish. Where this guide mentions a menu on the TV, you'll see the Spanish name first and the English meaning in brackets.

## What you need

- A box or TV running **Android TV 8 or later**.
- A **Windows PC** on the same Wi-Fi as the box. The commands are for Windows; on Linux or Mac they work the same with your own paths.
- The box's **remote**.
- Only if your box won't accept a network connection at first: a **USB male-to-male cable** (type A on both ends). The Mi Box 4 needed one.

No root, nothing to unlock. Everything you change can be undone in a minute (the last section shows how).

## 1. Turn on developer options on the box

1. On the box, go to **Settings → Device Preferences → About**.
2. Scroll down to **Build** and press OK seven times in a row. You'll see "You are now a developer".
3. Go back. **Developer options** now shows up under Device Preferences.
4. Open it and turn on **USB debugging**.

Write down the box's IP address: it's under **Settings → Network & Internet**, when you select your Wi-Fi network. Something like `192.168.1.40`. I'd reserve it in your router so it doesn't change; most routers have this in the DHCP section, tying the IP to the box's MAC address.

## 2. Install ADB on the PC

ADB is Android's official tool for talking to a device from a computer. Open a terminal (PowerShell) and type:

```powershell
winget install Google.PlatformTools
```

Close the terminal and open a new one. Check that it answers:

```powershell
adb version
```

If it says it can't find `adb`, look for it in `%LOCALAPPDATA%\Microsoft\WinGet\Packages\` (a folder starting with `Google.PlatformTools`) and use the full path, or add that folder to your PATH.

## 3. Connect the PC to the box

Try over the network first, with the IP you wrote down:

```powershell
adb connect 192.168.1.40:5555
```

The TV will ask **"Allow USB debugging?"**. Tick *Always allow from this computer* and accept.

**If you get "connection refused"** (it happened to me with the Mi Box 4), the box isn't listening on the network yet. You have to open the door once with a cable:

1. Connect the box to the PC with the USB male-to-male cable.
2. Run `adb devices` and accept the prompt on the TV.
3. Run `adb tcpip 5555`
4. Unplug the cable and repeat the `adb connect` above.

On my box the port stayed open after a reboot, so I only needed the cable that one time.

Check that everything works:

```powershell
adb devices
```

You should see the box's IP with the word `device` next to it.

## 4. Get the APK

**The easy way:** download `tvbox_customize.apk` from the repository's [releases page](https://github.com/1974julgebass/tvbox_customize/releases) and skip to step 5.

**If you'd rather build it yourself**, first get the project. With Git:

```powershell
git clone https://github.com/1974julgebass/tvbox_customize.git
```

Or from the repository page, with **Code → Download ZIP**.

To build it you need three things:

| Tool | How to install it |
|---|---|
| Java 17 | `winget install EclipseAdoptium.Temurin.17.JDK` |
| Android SDK (command-line tools only) | Download *Command line tools only* from developer.android.com/studio, unzip them to `C:\Android\sdk\cmdline-tools\latest` and run `C:\Android\sdk\cmdline-tools\latest\bin\sdkmanager "platforms;android-34" "build-tools;34.0.0"` |
| Gradle 8.9 | Download the zip from gradle.org/releases and unzip it to `C:\Android\gradle-8.9` |

You don't need Android Studio. Accept the SDK licenses once (answer `y` to everything):

```powershell
C:\Android\sdk\cmdline-tools\latest\bin\sdkmanager --licenses
```

If Gradle complains that it can't find Java, create a `JAVA_HOME` environment variable pointing to the JDK folder (something like `C:\Program Files\Eclipse Adoptium\jdk-17...`) and open a new terminal.

Create the file `android\local.properties` with the SDK path (note the double backslashes):

```properties
sdk.dir=C\:\\Android\\sdk
```

Then build from the project folder:

```powershell
C:\Android\gradle-8.9\bin\gradle.bat -p android assembleDebug
```

The first time takes a few minutes while it downloads dependencies. The APK ends up in `android\app\build\outputs\apk\debug\app-debug.apk`.

The home screen's interface lives in the `launcher/` folder (HTML, CSS and JavaScript). Every build copies it into the APK. If you change something there, build and install again.

## 5. Install the app on the box

```powershell
adb install -r tvbox_customize.apk
```

(Or `app-debug.apk`, if you built it yourself.)

It should answer `Success`. The same command works for later updates and keeps your favourites, reminders and paired phones.

## 6. Make it your home screen

```powershell
adb shell cmd package set-home-activity es.casa.inicio/.MainActivity
adb shell pm disable-user --user 0 com.google.android.tvlauncher
```

The second command disables Google's home screen. Without it, the remote's Home button keeps taking you to Google's even after you've picked another one. Nothing gets deleted: it just goes to sleep, and you can bring it back whenever you want.

If your box doesn't use the classic Google TV home screen and it has a different name, find out which one it is with:

```powershell
adb shell cmd package resolve-activity -a android.intent.action.MAIN -c android.intent.category.HOME
```

## 7. Grant the permissions

Android won't let a normal app grant itself these permissions, but you can grant them over ADB. Copy the whole block:

```powershell
adb shell appops set es.casa.inicio GET_USAGE_STATS allow
adb shell cmd notification allow_listener es.casa.inicio/es.casa.inicio.Escucha
adb shell appops set es.casa.inicio SYSTEM_ALERT_WINDOW allow
adb shell settings put secure enabled_accessibility_services es.casa.inicio/es.casa.inicio.Accion
adb shell settings put secure accessibility_enabled 1
adb shell settings put secure screensaver_components es.casa.inicio/es.casa.inicio.Sueno
```

What each one is for:

| Permission | What for |
|---|---|
| App usage | Knowing which app you used last, and opening the home screen on it. |
| Notifications | Noting what you're watching in each app ("Continue watching"). It only reads the title of what's playing; nothing leaves the box. |
| Display over other apps | The pop-up cards: a show starting, the sleep timer, an app installed from your phone. |
| Accessibility | The Restart and Power off buttons in the settings. It doesn't read the screen. |
| Screensaver | Using the app's own screensaver, with the time and your channels. |

Before changing the screensaver, if you want to be able to go back to the old one, note which one you have:

```powershell
adb shell settings get secure screensaver_components
```

## 8. Try it out

Press the **Home** button on the remote. The new screen should appear. If you see Google's, go back to step 6.

The first time you use the phone remote (or install an app), the TV will ask **"Allow USB debugging?"** again: that's the box asking itself for permission. Tick *Always allow* and accept. The setup manual covers this in more detail.

## The PC panel (optional)

The project also includes a web panel to control the box from your computer: see the TV screen, use the keyboard as a remote, install or disable apps, change settings and check its status.

![PC panel](../../manuales/capturas/panel.png)

To use it you need a server with PHP 8 on the same PC; I use XAMPP.

1. Copy the project folder into `C:\xampp\htdocs\`, for example as `tvbox`. Any folder works.
2. Copy `.env.example` to `.env` and fill in the box's IP and the full path to `adb.exe`:

   ```ini
   TV_HOST=192.168.1.40
   TV_PORT=5555
   ADB_PATH=C:\path\to\platform-tools\adb.exe
   ```

3. Start Apache and open `http://localhost/tvbox/`.

The panel only answers requests from the PC itself. If you open it from another device on your network you'll see "Solo desde este PC" (only from this PC). That's on purpose: the panel can install and uninstall apps without asking for a password.

## If something goes wrong

**`adb connect` says "failed to authenticate".** Look at the TV: it's waiting for you to accept the debugging prompt.

**The box changed IP.** Run `adb connect` again with the new one and, if you use the panel, change it in `.env`. Better to reserve it in the router.

**The Home button opens Google's screen.** Google's home screen is still enabled. Repeat the `pm disable-user` from step 6.

**"Continue watching" never shows up.** The notifications permission from step 7 is missing. Bear in mind it only works with apps that publish what they're playing (YouTube, Filmin and VLC do; some TV apps don't).

**The Restart and Power off buttons do nothing.** The accessibility permission is missing: repeat the `enabled_accessibility_services` and `accessibility_enabled` lines from step 7.

## Going back to how it was

Everything is reversible. To leave the box the way it came from the factory:

```powershell
adb shell pm enable com.google.android.tvlauncher
adb shell settings put secure screensaver_components com.google.android.backdrop/.Backdrop
adb shell settings put secure enabled_accessibility_services ""
adb uninstall es.casa.inicio
```

On the third line, if you had other accessibility services enabled, put them in place of the empty quotes. On the second, use the screensaver you noted in step 7 if it was a different one.

Finally, if you want to close ADB's network door, turn off **USB debugging** in the developer options.
