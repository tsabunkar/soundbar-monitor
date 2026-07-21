# SoundBar Monitor v2.0.0

macOS menu bar app that captures microphone audio and displays live audio visualization in the tray icon, with a visualizer window.

## Features

- **Menu bar icon** — live audio visualization in the tray (4 styles synced to the visualizer window)
- **Visualizer window** — real-time canvas rendering with 4 modes: Bars, Waveform, Spectrum, Circle
- **Mic input selector** — choose any connected microphone from the toolbar dropdown
- **Safe zone presets** — EBU R128, Podcast/Speech, Music Production (selectable from tray right-click menu)
- **RMS/Peak metering** — tooltip shows current levels in dBFS
- **Dock icon** — custom favicon shown in the dock
- **Mic selection gate** — visualization starts only after picking a specific microphone

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
| Bars | 32 bars across the frequency spectrum |
| Waveform | Smooth bottom-up frequency line with blue glow |
| Spectrum | Filled frequency spectrum with orange gradient |
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
├── favicon.png                 # App icon
├── renderer/
│   ├── visualizer.html         # Visualizer window
│   ├── visualizer.js           # Canvas rendering & UI
│   ├── visualizer.css          # Styles
│   └── shared/
│       └── audio-pipeline.js   # Audio capture & FFT engine
└── assets/
    └── icon.svg                # App icon source
```

## Packaging

Build a standalone `.dmg`:

```bash
npm run dist
```

Output: `dist/SoundBar Monitor-2.0.0-arm64.dmg`

### Deploying a Release

Publish a new release:

```bash
npm run release
```

This builds the app and syncs the `.dmg` to `s3://tsabunkar-downloads/desktops-app/soundbar-monitor/`, served via CloudFront CDN. Users can download the latest version from the browseable CDN.

> **Note:** The S3 bucket and CloudFront distribution are managed in the [`downloads-tsabunkar-hosting-terraform`](https://github.com/tsabunkar/downloads-tsabunkar-hosting-terraform) project.

The app is unsigned by default — right-click → Open to bypass Gatekeeper on first launch. To sign, set `CSC_LINK` and `CSC_KEY_PASSWORD` with an Apple Developer certificate.

## Privacy

All audio is processed locally. No data is sent over the network.

---

Created by [Tejas Sabunkar](https://tsabunkar.com). If you like this app, feel free to support → https://tsabunkar.com/#support
