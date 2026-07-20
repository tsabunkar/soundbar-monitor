# SoundBar Monitor

macOS menu bar app that captures microphone audio and displays live audio visualization in the tray icon, with a visualizer window.

## Features

- **Menu bar icon** — live audio visualization in the tray (4 styles synced to the visualizer window)
- **Visualizer window** — real-time canvas rendering with 4 modes: Bars, Waveform, Spectrum, Circle
- **Mic input selector** — choose any connected microphone from the toolbar dropdown
- **Safe zone presets** — EBU R128, Podcast/Speech, Music Production (selectable from tray right-click menu)
- **RMS/Peak metering** — tooltip shows current levels in dBFS

## Requirements

- macOS 12+
- Node.js **22+** (see `.nvmrc`)

## Setup

```bash
nvm use
npm install
```

## Usage

```bash
npm start
```

### Controls

| Action | How |
|---|---|
| Open/close visualizer | Click tray icon, or press `Cmd+Shift+V` |
| Cycle visualizer style | Click `‹` / `›` in the toolbar |
| Select microphone | Choose from the dropdown in the visualizer toolbar |
| Switch safe zone preset | Right-click tray icon → Presets |
| Open DevTools | Click `⚙` in the visualizer toolbar |

### Visualizer Styles

| Style | Description |
|---|---|
| Bars | 64 columns mapped across the frequency spectrum |
| Waveform | Center-symmetrical line across the canvas |
| Spectrum | Bottom-up frequency spectrum with gradient fill |
| Circle | Pulsing ring that responds to RMS level + FFT |

### Safe Zone Presets

| Preset | Range |
|---|---|
| Full Range | -60 to 0 dBFS |
| EBU R128 | -18 to -12 dBFS |
| Podcast / Speech | -12 to -6 dBFS |
| Music Production | -6 to -3 dBFS |

## Project Structure

```
soundbar-monitor/
├── main.js                     # Electron main process
├── preload.js                  # Context bridge API
├── renderer/
│   ├── visualizer.html         # Visualizer window
│   ├── visualizer.js           # Canvas rendering & UI
│   ├── visualizer.css          # Styles
│   └── shared/
│       └── audio-pipeline.js   # Audio capture & FFT engine
├── build/
│   └── entitlements.mac.plist  # macOS entitlements for mic access
└── assets/
    └── icon.svg                # App icon source
```

## Packaging

Build a standalone `.dmg`:

```bash
npm run dist
```

Output: `dist/SoundBar Monitor-1.0.0-arm64.dmg`

The app is unsigned by default — right-click → Open to bypass Gatekeeper on first launch. To sign, set `CSC_LINK` and `CSC_KEY_PASSWORD` with an Apple Developer certificate.

## Privacy

All audio is processed locally. No data is sent over the network.

---

Created by [Tejas Sabunkar](https://tsabunkar.com). If you like this app, feel free to support → https://tsabunkar.com/#support
