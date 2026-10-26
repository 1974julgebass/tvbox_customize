English · [Español](README.md)

# Home for Android TV

A home screen of your own for Android TV boxes, with no ads and nobody's recommendations. I built it for the Xiaomi Mi Box 4 in our living room because Google's had turned into a shop window: banners for shows I don't watch, rows I can't remove, and my own apps buried at the bottom.

![Home screen](docs/manuales/capturas/inicio.png)

What it does:

- **Your apps, in your order**, and nothing else.
- **What's on now** on your TV channels, with each channel's logo, and reminders for the show you don't want to miss.
- **Continue watching**: the last thing you watched in each app, gathered in a single row.
- **The weather** in your city, sunrise and sunset, and the phase of the moon.
- **A screensaver** with the time, the weather and your channels.
- **Your phone as a remote**, with nothing to install: scan a QR code on the TV and you're done.
- **Install apps** from a USB stick or by sending them from your phone.
- **Sleep timer** and automatic reminders when your team or your show is on.
- **A PC panel** (optional) to see the TV screen, control it with the keyboard, and install or disable apps.

The interface is in Spanish, and the TV guide covers Spanish channels.

## Manuals

They're also available as a website, with the same design: **[1974julgebass.github.io/tvbox_customize/en](https://1974julgebass.github.io/tvbox_customize/en/)**

1. [Installation](docs/en/manuals/01-installation.md): get the box and the PC ready, install the app and grant its permissions.
2. [Setup](docs/en/manuals/02-setup.md): your apps, the city, reminders, the phone and the screensaver.
3. [Usage](docs/en/manuals/03-usage.md): day to day with the remote.

## Download

The ready-to-install APK is under [Releases](https://github.com/1974julgebass/tvbox_customize/releases). If you'd rather build it yourself, the installation manual explains how.

## Requirements

- A box or TV running Android TV 8 or later. Tested on a Xiaomi Mi Box 4 (Android TV 9).
- A PC for the installation. After that you don't need it: the box runs on its own.

No root needed, and everything can be undone.

## What's in each folder

| Folder | What it is |
|---|---|
| `launcher/` | The home screen interface, the screensaver and the phone remote (HTML, CSS and JavaScript). You can open it in a desktop browser with sample data: the arrow keys work as the remote. |
| `android/` | The Android app that wraps it: home screen, permissions, guide, reminders, screensaver and the phone remote's server. |
| `index.php`, `api/`, `includes/`, `css/`, `js/` | The optional PC panel (PHP 8 and ADB). |
| `docs/` | The manuals, in Markdown and HTML, in Spanish and English. |
| `herramientas/` | The script that builds the manuals' HTML pages. |

## License

[MIT](https://github.com/1974julgebass/tvbox_customize/blob/main/LICENSE). Use it, change it and share it however you like; just keep the license notice.

## Credits

- TV guide and channel logos: [EPG_dobleM](https://github.com/davidmuma/EPG_dobleM). The app downloads them from that repository; they aren't included here.
- Weather and city search: [Open-Meteo](https://open-meteo.com/).
- QR code generator: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), by Kazuhiko Arase (MIT).
- Moon calculations: based on [SunCalc](https://github.com/mourner/suncalc), by Vladimir Agafonkin (BSD-2).
- The app's ADB client: [dadb](https://github.com/mobile-dev-inc/dadb), by mobile.dev (Apache 2.0).
- Typeface: [Bricolage Grotesque](https://github.com/ateliertriay/bricolage) (SIL Open Font License 1.1).
