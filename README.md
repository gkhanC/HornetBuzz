# HornetBuzz (Hornet Gift Sound Trigger)

A Chrome extension for Hornet Live that intercepts web socket events to provide real-time audio feedback for gifts and text-to-speech (TTS) for incoming chat messages. Ideal for streamers replying on distinct, unattended alerts.

## ✨ Features

- **Gift Detection & Goal Tracking:** Intercepts real-time events to track incoming gifts and updates the live goal.
- **Tiered Audio Alerts:** Triggers dynamic sound effects based on the credit value of the received gift (e.g., 5, 10, 20, 100, 200+ amounts trigger different MP3s).
- **Text-to-Speech Chat:** Automatically reads out live chat messages using high-quality Microsoft Edge TTS integration (tr-TR-AhmetNeural).
- **Chat Moderation:** Includes a customizable active whitelist/blacklist mode alongside a built-in profanity filter.
- **Offscreen Audio Engine:** Uses the modern Chrome Offscreen API for smooth, background audio and speech playback without interruption. 

## 📦 Installation

This extension is built for Chrome (Manifest V3) as an unpacked developer extension.

1. Clone or download this repository to your local machine.
2. Open Microsoft Edge, Google Chrome, or any Chromium-based browser and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (usually a toggle in the top-right corner).
4. Click the **Load unpacked** button.
5. Select the `HornetBuzz` directory containing the `manifest.json` file.

## 📁 Repository Structure

- `manifest.json` - Core configuration and network/storage permissions.
- `background.js` - Extension service worker managing states, audio triggering logic, and Edge TTS WebSockets generator.
- `inject.js` & `content-script.js` - Network interceptors that monitor the host application frames to extract incoming gifts and goals.
- `offscreen.html` & `offscreen.js` - Hidden document handler dedicated strictly to reliable audio playback.
- `popup.html` / `popup.js` / `popup.css` - The user interface to view event history, goals, and configure chat moderation settings.
- `sounds/` - Directory housing the tiered MP3 sound alerts (`ses1.mp3`, `ses2.mp3`, etc.).

## ⚙️ Usage

Once the extension is active on supported domains (`*.hornet.com`, `*.hornetapp.com`, `*.hornet-live.com`):
1. It immediately starts listening for payload events via `document_start`.
2. Click the extension icon to view history, goal progress, and configure chat filtering (whitelist/blacklist).
3. The TTS background engine will read valid chat messages that pass the profanity checks.

## ⚠️ Disclaimer

This tool ("Extreme Detection Version") utilizes active WebSocket interception on internal live APIs. If the underlying web architecture changes, the interception rules or WebSocket handlers may require updating. Use responsibly and conform to platform rules.
